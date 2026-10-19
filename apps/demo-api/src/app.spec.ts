import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  jwtVerify,
  SignJWT,
  type CryptoKey,
  type JSONWebKeySet,
} from 'jose';
import request from 'supertest';
import { createApi } from './app';

const ISSUER = 'http://localhost:8080/realms/microfrontend';
let signingKey: CryptoKey;
let otherKey: CryptoKey;
let jwks: JSONWebKeySet;

beforeAll(async () => {
  const pair = await generateKeyPair('RS256');
  signingKey = pair.privateKey;
  otherKey = (await generateKeyPair('RS256')).privateKey;
  jwks = {
    keys: [{ ...(await exportJWK(pair.publicKey)), kid: 'k1', alg: 'RS256' }],
  };
});

function token(
  claims: Record<string, unknown>,
  opts: { aud?: string; exp?: string; key?: CryptoKey } = {},
) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
    .setIssuer(ISSUER)
    .setAudience(opts.aud ?? 'demo-api')
    .setSubject('user-1')
    .setIssuedAt()
    .setExpirationTime(opts.exp ?? '5m')
    .sign(opts.key ?? signingKey);
}

function app() {
  const keys = createLocalJWKSet(jwks);
  return createApi(async (t) => {
    const { payload } = await jwtVerify(t, keys, {
      issuer: ISSUER,
      audience: 'demo-api',
    });
    return payload;
  });
}

describe('demo-api', () => {
  it('returns items for a valid token with demo-access', async () => {
    const t = await token({ roles: ['shell-user', 'demo-access'] });
    const res = await request(app())
      .get('/api/hello')
      .set('Authorization', `Bearer ${t}`);
    expect(res.status).toBe(200);
    expect(res.body.subject).toBe('user-1');
    expect(res.body.items.length).toBeGreaterThan(0);
  });

  it('echoes JSON bodies', async () => {
    const t = await token({ roles: ['demo-access'] });
    const res = await request(app())
      .post('/api/echo')
      .set('Authorization', `Bearer ${t}`)
      .send({ message: 'hi' });
    expect(res.status).toBe(200);
    expect(res.body.echoed).toEqual({ message: 'hi' });
  });

  it('rejects requests without a bearer token', async () => {
    const res = await request(app()).get('/api/hello');
    expect(res.status).toBe(401);
  });

  it('rejects a token for another audience', async () => {
    const t = await token({ roles: ['demo-access'] }, { aud: 'account' });
    const res = await request(app())
      .get('/api/hello')
      .set('Authorization', `Bearer ${t}`);
    expect(res.status).toBe(401);
  });

  it('rejects an expired token', async () => {
    const t = await token({ roles: ['demo-access'] }, { exp: '1s ago' });
    const res = await request(app())
      .get('/api/hello')
      .set('Authorization', `Bearer ${t}`);
    expect(res.status).toBe(401);
  });

  it('rejects a token signed by an unknown key', async () => {
    const t = await token({ roles: ['demo-access'] }, { key: otherKey });
    const res = await request(app())
      .get('/api/hello')
      .set('Authorization', `Bearer ${t}`);
    expect(res.status).toBe(401);
  });

  it('forbids users without demo-access', async () => {
    const t = await token({ roles: ['shell-user'] });
    const res = await request(app())
      .get('/api/hello')
      .set('Authorization', `Bearer ${t}`);
    expect(res.status).toBe(403);
  });
});
