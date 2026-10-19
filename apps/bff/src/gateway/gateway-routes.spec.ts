import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { createApp } from '../app';
import { TokenProvider } from '../auth/token-refresh';
import { parseRegistry } from '../registry/registry';
import { CSRF_COOKIE } from '../security/csrf';
import { MemorySessionStore } from '../session/memory-session-store';
import {
  CookieJar,
  FakeOidc,
  PUBLIC_ORIGIN,
  testConfig,
} from '../testing/test-helpers';
import { gatewayRoutes } from './gateway-routes';

let workDir: string;
let upstream: Server;
let upstreamUrl: string;
let lastUpstream: {
  url?: string;
  headers?: IncomingHttpHeaders;
  body?: string;
} = {};

beforeAll(async () => {
  workDir = mkdtempSync(join(tmpdir(), 'bff-gateway-'));
  mkdirSync(join(workDir, 'shell'));
  mkdirSync(join(workDir, 'demo'));
  writeFileSync(
    join(workDir, 'shell', 'index.html'),
    '<html><body><sh-root ngCspNonce="__CSP_NONCE__"></sh-root><script src="main.js" type="module"></script></body></html>',
  );
  writeFileSync(join(workDir, 'shell', 'main.js'), 'console.log("shell")');
  writeFileSync(join(workDir, 'demo', 'remoteEntry.json'), '{"name":"demo"}');

  upstream = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    lastUpstream = { url: req.url, headers: req.headers, body };
    res.writeHead(200, {
      'content-type': 'application/json',
      'set-cookie': 'upstream=1; Path=/',
    });
    res.end(JSON.stringify({ ok: true }));
  });
  await new Promise<void>((resolve) =>
    upstream.listen(0, '127.0.0.1', resolve),
  );
  upstreamUrl = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`;
});

afterAll(async () => {
  rmSync(workDir, { recursive: true, force: true });
  await new Promise((resolve) => upstream.close(resolve));
});

function setup(roles: string[]) {
  const oidc = new FakeOidc();
  oidc.claims = { ...oidc.claims, roles };
  const registry = parseRegistry({
    remotes: [
      {
        name: 'demo',
        title: 'Demo',
        route: 'demo',
        remoteEntry: '/apps/demo/remoteEntry.json',
        exposedModule: './routes',
        requiredRoles: ['demo-access'],
        staticDir: join(workDir, 'demo'),
      },
    ],
  });
  const routes = gatewayRoutes({
    mode: 'static',
    registry,
    tokens: new TokenProvider(oidc),
    apiUpstreamUrl: upstreamUrl,
    shellStaticDir: join(workDir, 'shell'),
  });
  const app = createApp({
    config: testConfig(),
    oidc,
    store: new MemorySessionStore(),
    routes,
  });
  return { app, oidc };
}

async function signedIn(roles: string[]) {
  const { app, oidc } = setup(roles);
  const jar = new CookieJar();
  jar.store(await request(app).get('/auth/login'));
  jar.store(
    await request(app)
      .get(`/auth/callback?code=c&state=${oidc.lastRequest?.state}`)
      .set('Cookie', jar.header()),
  );
  return { app, jar };
}

describe('GET /registry', () => {
  it('requires a session', async () => {
    const { app } = setup([]);
    const res = await request(app)
      .get('/registry')
      .set('Accept', 'application/json');
    expect(res.status).toBe(401);
  });

  it('includes the demo remote for a user with demo-access', async () => {
    const { app, jar } = await signedIn(['shell-user', 'demo-access']);
    const res = await request(app).get('/registry').set('Cookie', jar.header());
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.manifest).toEqual({ demo: '/apps/demo/remoteEntry.json' });
    expect(res.body.items).toEqual([
      {
        name: 'demo',
        title: 'Demo',
        route: 'demo',
        exposedModule: './routes',
        requiredRoles: ['demo-access'],
      },
    ]);
    expect(res.body.restrictedRoutes).toEqual([]);
  });

  it('hides the demo remote from a user without the role', async () => {
    const { app, jar } = await signedIn(['shell-user']);
    const res = await request(app).get('/registry').set('Cookie', jar.header());
    expect(res.body).toEqual({
      manifest: {},
      items: [],
      restrictedRoutes: ['demo'],
    });
  });
});

describe('/apps/:name', () => {
  it('serves remote files to users holding the role', async () => {
    const { app, jar } = await signedIn(['shell-user', 'demo-access']);
    const res = await request(app)
      .get('/apps/demo/remoteEntry.json')
      .set('Cookie', jar.header());
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-cache');
  });

  it('refuses remote files to users without the role', async () => {
    const { app, jar } = await signedIn(['shell-user']);
    const res = await request(app)
      .get('/apps/demo/remoteEntry.json')
      .set('Cookie', jar.header());
    expect(res.status).toBe(403);
  });

  it('refuses anonymous access', async () => {
    const { app } = setup([]);
    const res = await request(app).get('/apps/demo/remoteEntry.json');
    expect(res.status).toBe(401);
  });

  it('returns 404 for apps that are not in the registry', async () => {
    const { app, jar } = await signedIn(['shell-user', 'demo-access']);
    const res = await request(app)
      .get('/apps/other/remoteEntry.json')
      .set('Cookie', jar.header());
    expect(res.status).toBe(404);
  });

  it('does not allow path traversal out of the remote directory', async () => {
    const { app, jar } = await signedIn(['shell-user', 'demo-access']);
    const res = await request(app)
      .get('/apps/demo/..%2f..%2fshell%2findex.html')
      .set('Cookie', jar.header());
    expect([400, 403, 404]).toContain(res.status);
  });
});

describe('/api/*', () => {
  it('rejects writes without a CSRF token', async () => {
    const { app, jar } = await signedIn(['shell-user', 'demo-access']);
    const res = await request(app)
      .post('/api/echo')
      .set('Cookie', jar.header())
      .set('Origin', PUBLIC_ORIGIN)
      .send({ a: 1 });
    expect(res.status).toBe(403);
  });

  it('forwards with a bearer token, without cookies, and drops upstream cookies', async () => {
    const { app, jar } = await signedIn(['shell-user', 'demo-access']);
    const res = await request(app)
      .post('/api/echo')
      .set('Cookie', jar.header())
      .set('Origin', PUBLIC_ORIGIN)
      .set('X-XSRF-TOKEN', jar.get(CSRF_COOKIE) ?? '')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ a: 1 }));
    expect(res.status).toBe(200);
    const cookies = (res.headers['set-cookie'] ?? []) as unknown as string[];
    expect(cookies.some((c) => c.startsWith('upstream='))).toBe(false);
    expect(lastUpstream.url).toBe('/api/echo');
    expect(lastUpstream.headers?.['authorization']).toMatch(/^Bearer eyJ/);
    expect(lastUpstream.headers?.['cookie']).toBeUndefined();
    expect(lastUpstream.headers?.['x-xsrf-token']).toBeUndefined();
    expect(lastUpstream.body).toBe('{"a":1}');
  });

  it('requires a session', async () => {
    const { app } = setup([]);
    const res = await request(app).get('/api/hello');
    expect(res.status).toBe(401);
  });
});

describe('shell and security headers', () => {
  it('redirects anonymous page navigations to login', async () => {
    const { app } = setup([]);
    const res = await request(app).get('/demo').set('Accept', 'text/html');
    expect(res.status).toBe(302);
    expect(res.headers['location']).toBe('/auth/login?returnTo=%2Fdemo');
  });

  it('serves index.html with a fresh nonce on every request', async () => {
    const { app, jar } = await signedIn(['shell-user']);
    const a = await request(app)
      .get('/demo')
      .set('Accept', 'text/html')
      .set('Cookie', jar.header());
    const b = await request(app)
      .get('/')
      .set('Accept', 'text/html')
      .set('Cookie', jar.header());
    const nonceOf = (csp: string) => /'nonce-([^']+)'/.exec(csp)?.[1];
    const nonceA = nonceOf(a.headers['content-security-policy']);
    const nonceB = nonceOf(b.headers['content-security-policy']);
    expect(nonceA).toBeDefined();
    expect(nonceA).not.toBe(nonceB);
    expect(a.text).toContain(`ngCspNonce="${nonceA}"`);
    expect(a.text).toContain(`<script nonce="${nonceA}" src="main.js"`);
    expect(a.text).not.toContain('__CSP_NONCE__');
  });

  it('sends the full header set with a strict CSP', async () => {
    const { app } = setup([]);
    const res = await request(app).get('/main.js');
    expect(res.status).toBe(200);
    const csp = res.headers['content-security-policy'];
    expect(csp).toContain("default-src 'self'");
    expect(csp).toMatch(/script-src 'self' 'nonce-[^']+'/);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain('report-uri /csp-report');
    expect(csp).toContain("require-trusted-types-for 'script'");
    expect(csp).not.toContain('unsafe-inline');
    expect(csp).not.toContain('unsafe-eval');
    expect(res.headers['strict-transport-security']).toContain(
      'max-age=31536000',
    );
    expect(res.headers['referrer-policy']).toBe(
      'strict-origin-when-cross-origin',
    );
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['cross-origin-opener-policy']).toBe('same-origin');
    expect(res.headers['permissions-policy']).toContain('camera=()');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('accepts CSP reports without a session or CSRF token', async () => {
    const { app } = setup([]);
    const res = await request(app)
      .post('/csp-report')
      .set('Content-Type', 'application/csp-report')
      .send(
        JSON.stringify({
          'csp-report': { 'violated-directive': 'script-src' },
        }),
      );
    expect(res.status).toBe(204);
  });
});

describe('parseRegistry', () => {
  const base = {
    name: 'demo',
    title: 'Demo',
    route: 'demo',
    remoteEntry: '/apps/demo/remoteEntry.json',
    exposedModule: './routes',
    requiredRoles: [],
  };

  it('rejects remote entries outside the gateway path', () => {
    expect(() =>
      parseRegistry({
        remotes: [
          { ...base, remoteEntry: 'https://cdn.evil/remoteEntry.json' },
        ],
      }),
    ).toThrow(/must live under/);
  });

  it('rejects unsafe names and duplicates', () => {
    expect(() =>
      parseRegistry({ remotes: [{ ...base, name: '../x' }] }),
    ).toThrow(/invalid name/);
    expect(() => parseRegistry({ remotes: [base, base] })).toThrow(/duplicate/);
  });
});
