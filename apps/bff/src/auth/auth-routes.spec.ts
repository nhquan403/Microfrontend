import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../app';
import { MemorySessionStore } from '../session/memory-session-store';
import { SESSION_COOKIE } from '../session/session';
import { CSRF_COOKIE } from '../security/csrf';
import {
  CookieJar,
  FakeOidc,
  PUBLIC_ORIGIN,
  setCookieFor,
  testConfig,
} from '../testing/test-helpers';

let clock = Date.now();
const now = () => clock;

function setup(overrides = {}) {
  const oidc = new FakeOidc();
  const store = new MemorySessionStore(60_000, now);
  const app = createApp({ config: testConfig(overrides), oidc, store, now });
  return { app, oidc, store };
}

async function signIn(
  app: Express,
  oidc: FakeOidc,
  jar = new CookieJar(),
  returnTo = '/demo',
) {
  const login = await request(app).get(
    `/auth/login?returnTo=${encodeURIComponent(returnTo)}`,
  );
  jar.store(login);
  const state = oidc.lastRequest?.state;
  const callback = await request(app)
    .get(`/auth/callback?code=abc&state=${state}`)
    .set('Cookie', jar.header());
  jar.store(callback);
  return { login, callback, jar };
}

beforeEach(() => {
  clock = Date.now();
});

describe('GET /auth/login', () => {
  it('redirects to the identity provider with a PKCE S256 request', async () => {
    const { app } = setup();
    const res = await request(app).get('/auth/login');
    expect(res.status).toBe(302);
    const location = new URL(res.headers['location']);
    expect(location.origin).toBe('http://idp.test');
    expect(location.searchParams.get('code_challenge_method')).toBe('S256');
    expect(location.searchParams.get('redirect_uri')).toBe(
      `${PUBLIC_ORIGIN}/auth/callback`,
    );
  });

  it('ignores an absolute returnTo to prevent open redirects', async () => {
    const { app, oidc } = setup();
    const { callback } = await signIn(
      app,
      oidc,
      new CookieJar(),
      'https://evil.example/steal',
    );
    expect(callback.status).toBe(302);
    expect(callback.headers['location']).toBe('/');
  });
});

describe('GET /auth/callback', () => {
  it('rejects a state that does not match the pending login', async () => {
    const { app } = setup();
    const jar = new CookieJar();
    jar.store(await request(app).get('/auth/login'));
    const res = await request(app)
      .get('/auth/callback?code=abc&state=forged')
      .set('Cookie', jar.header());
    expect(res.status).toBe(400);
  });

  it('rejects a callback without a pending login', async () => {
    const { app } = setup();
    const res = await request(app).get('/auth/callback?code=abc&state=x');
    expect(res.status).toBe(400);
  });

  it('rejects a login that took longer than the pending window', async () => {
    const { app, oidc } = setup();
    const jar = new CookieJar();
    jar.store(await request(app).get('/auth/login'));
    clock += 11 * 60_000;
    const res = await request(app)
      .get(`/auth/callback?code=abc&state=${oidc.lastRequest?.state}`)
      .set('Cookie', jar.header());
    expect(res.status).toBe(400);
  });

  it('rejects when the code exchange fails verification', async () => {
    const { app, oidc } = setup();
    oidc.exchangeError = new Error('unexpected ID Token "nonce" claim value');
    const { callback } = await signIn(app, oidc);
    expect(callback.status).toBe(400);
  });

  it('rejects an identity provider error response', async () => {
    const { app } = setup();
    const res = await request(app).get(
      '/auth/callback?error=access_denied&state=x',
    );
    expect(res.status).toBe(400);
  });

  it('signs in, rotates the session id and issues hardened cookies', async () => {
    const { app, oidc } = setup();
    const { login, callback } = await signIn(app, oidc);
    expect(callback.status).toBe(302);
    expect(callback.headers['location']).toBe('/demo');

    const before = setCookieFor(login, SESSION_COOKIE)?.split(';')[0];
    const session = setCookieFor(callback, SESSION_COOKIE);
    expect(session).toBeDefined();
    expect(session?.split(';')[0]).not.toBe(before);
    expect(session).toMatch(/HttpOnly/i);
    expect(session).toMatch(/Secure/i);
    expect(session).toMatch(/SameSite=Lax/i);
    expect(session).toMatch(/Path=\//i);

    const csrf = setCookieFor(callback, CSRF_COOKIE);
    expect(csrf).toMatch(/Secure/i);
    expect(csrf).toMatch(/SameSite=Strict/i);
    expect(csrf).not.toMatch(/HttpOnly/i);
  });
});

describe('GET /auth/me', () => {
  it('returns the user profile without any token material', async () => {
    const { app, oidc } = setup();
    const { jar } = await signIn(app, oidc);
    const res = await request(app).get('/auth/me').set('Cookie', jar.header());
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      sub: 'user-1',
      name: 'Alice Demo',
      email: 'alice@example.test',
      roles: ['shell-user', 'demo-access'],
    });
    expect(res.text).not.toMatch(/eyJ/);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('returns 401 JSON to API callers when signed out', async () => {
    const { app } = setup();
    const res = await request(app)
      .get('/auth/me')
      .set('Accept', 'application/json');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'unauthenticated' });
  });

  it('ends the session after the absolute lifetime even when active', async () => {
    const { app, oidc } = setup();
    const { jar } = await signIn(app, oidc);
    clock += 8 * 3_600_000 + 1000;
    const res = await request(app).get('/auth/me').set('Cookie', jar.header());
    expect(res.status).toBe(401);
  });
});

describe('POST /auth/logout', () => {
  it('rejects a request without the CSRF header', async () => {
    const { app, oidc } = setup();
    const { jar } = await signIn(app, oidc);
    const res = await request(app)
      .post('/auth/logout')
      .set('Cookie', jar.header())
      .set('Origin', PUBLIC_ORIGIN);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('csrf_token_invalid');
  });

  it('rejects a request from another origin even with the token', async () => {
    const { app, oidc } = setup();
    const { jar } = await signIn(app, oidc);
    const res = await request(app)
      .post('/auth/logout')
      .set('Cookie', jar.header())
      .set('Origin', 'https://evil.example')
      .set('X-XSRF-TOKEN', jar.get(CSRF_COOKIE) ?? '');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('origin_mismatch');
  });

  it('destroys the session and returns the identity provider logout URL', async () => {
    const { app, oidc } = setup();
    const { jar } = await signIn(app, oidc);
    const res = await request(app)
      .post('/auth/logout')
      .set('Cookie', jar.header())
      .set('Origin', PUBLIC_ORIGIN)
      .set('X-XSRF-TOKEN', jar.get(CSRF_COOKIE) ?? '');
    expect(res.status).toBe(200);
    const logoutUrl = new URL(res.body.logoutUrl);
    expect(logoutUrl.origin).toBe('http://idp.test');
    expect(logoutUrl.searchParams.get('id_token_hint')).toBe('present');
    expect(logoutUrl.searchParams.get('post_logout_redirect_uri')).toBe(
      `${PUBLIC_ORIGIN}/`,
    );

    const me = await request(app).get('/auth/me').set('Cookie', jar.header());
    expect(me.status).toBe(401);
  });
});

describe('rate limiting', () => {
  it('limits /auth requests per client', async () => {
    const { app } = setup({ authRateLimitPerMinute: 3 });
    for (let i = 0; i < 3; i++) {
      expect((await request(app).get('/auth/login')).status).toBe(302);
    }
    expect((await request(app).get('/auth/login')).status).toBe(429);
  });
});
