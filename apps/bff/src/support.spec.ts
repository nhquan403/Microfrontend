import { safeReturnTo } from './auth/return-to';
import { loadConfig } from './config';
import { redact } from './logging/logger';
import { MemorySessionStore } from './session/memory-session-store';
import { fakeJwt } from './testing/test-helpers';

const ORIGIN = 'http://localhost:4000';

describe('safeReturnTo', () => {
  it.each([
    ['/demo?tab=1#x', '/demo?tab=1#x'],
    ['/', '/'],
    ['https://evil.example/', '/'],
    ['//evil.example/', '/'],
    ['/\\evil.example', '/'],
    ['/auth/logout', '/'],
    ['javascript:alert(1)', '/'],
    [undefined, '/'],
    [['/a'], '/'],
  ])('%s -> %s', (input, expected) => {
    expect(safeReturnTo(input, ORIGIN)).toBe(expected);
  });
});

describe('redact', () => {
  it('masks sensitive keys and JWT-shaped strings', () => {
    const out = redact({
      cookie: 'a=b',
      authorization: 'Bearer x',
      refreshToken: 'r',
      nested: { message: `got ${fakeJwt({ sub: 'u' })} back`, path: '/demo' },
    }) as Record<string, unknown>;
    expect(out['cookie']).toBe('[redacted]');
    expect(out['authorization']).toBe('[redacted]');
    expect(out['refreshToken']).toBe('[redacted]');
    expect(JSON.stringify(out)).not.toMatch(/eyJ/);
    expect((out['nested'] as Record<string, unknown>)['path']).toBe('/demo');
  });
});

describe('MemorySessionStore', () => {
  it('expires sessions after their idle TTL and extends it on touch', async () => {
    let clock = 0;
    const store = new MemorySessionStore(60_000, () => clock);
    const data = { cookie: { originalMaxAge: 1000 } } as never;
    await store.set('s', data, 1000);
    clock = 900;
    await store.touch('s', data, 1000);
    clock = 1800;
    expect(await store.get('s')).toBeDefined();
    clock = 2000;
    expect(await store.get('s')).toBeUndefined();
    store.close();
  });
});

describe('loadConfig', () => {
  const base = {
    PUBLIC_ORIGIN: ORIGIN,
    SESSION_SECRET: 'x'.repeat(32),
    OIDC_ISSUER: 'http://localhost:8080/realms/microfrontend',
    OIDC_CLIENT_ID: 'shell-bff',
    OIDC_CLIENT_SECRET: 's',
    API_UPSTREAM_URL: 'http://127.0.0.1:4100',
  };

  it('applies the agreed session timeouts by default', () => {
    const config = loadConfig(base);
    expect(config.session.idleMs).toBe(30 * 60_000);
    expect(config.session.absoluteMs).toBe(8 * 3_600_000);
    expect(config.insecureLocalhost).toBe(true);
  });

  it('refuses to start without required secrets', () => {
    expect(() => loadConfig({ ...base, OIDC_CLIENT_SECRET: '' })).toThrow(
      /OIDC_CLIENT_SECRET/,
    );
    expect(() => loadConfig({ ...base, SESSION_SECRET: 'short' })).toThrow(
      /SESSION_SECRET/,
    );
  });

  it('only enables the localhost cookie shim for http://localhost', () => {
    expect(
      loadConfig({ ...base, PUBLIC_ORIGIN: 'https://app.example' })
        .insecureLocalhost,
    ).toBe(false);
  });
});
