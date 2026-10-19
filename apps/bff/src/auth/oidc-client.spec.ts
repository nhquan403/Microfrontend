import { createHash } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  exportJWK,
  generateKeyPair,
  SignJWT,
  type CryptoKey,
  type JWK,
} from 'jose';
import { createOidcClient, type OidcClient } from './oidc-client';

/**
 * A tiny in-process identity provider so the real openid-client validation
 * (state, PKCE, ID token signature, nonce) is exercised without mocks.
 */
interface FakeIdp {
  issuer: string;
  close(): Promise<void>;
  /** What the token endpoint should put into the ID token for the next exchange. */
  next: { nonce?: string; signWithOtherKey?: boolean };
  lastCodeVerifier?: string;
}

async function startFakeIdp(): Promise<FakeIdp> {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const other = await generateKeyPair('RS256');
  const jwk: JWK = {
    ...(await exportJWK(publicKey)),
    kid: 'k1',
    alg: 'RS256',
    use: 'sig',
  };
  const codes = new Map<string, { challenge: string; nonce: string }>();

  const idp: FakeIdp = { issuer: '', next: {}, close: async () => undefined };
  const sign = (key: CryptoKey, claims: Record<string, unknown>) =>
    new SignJWT(claims)
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setIssuer(idp.issuer)
      .setAudience('shell-bff')
      .setSubject('user-1')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(key);

  const server: Server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', idp.issuer);
    const json = (status: number, body: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (url.pathname === '/.well-known/openid-configuration') {
      json(200, {
        issuer: idp.issuer,
        authorization_endpoint: `${idp.issuer}/auth`,
        token_endpoint: `${idp.issuer}/token`,
        jwks_uri: `${idp.issuer}/jwks`,
        end_session_endpoint: `${idp.issuer}/logout`,
        response_types_supported: ['code'],
        subject_types_supported: ['public'],
        id_token_signing_alg_values_supported: ['RS256'],
        code_challenge_methods_supported: ['S256'],
      });
      return;
    }
    if (url.pathname === '/jwks') {
      json(200, { keys: [jwk] });
      return;
    }
    if (url.pathname === '/register-code') {
      codes.set(url.searchParams.get('code') ?? '', {
        challenge: url.searchParams.get('challenge') ?? '',
        nonce: url.searchParams.get('nonce') ?? '',
      });
      json(200, {});
      return;
    }
    if (url.pathname === '/token' && req.method === 'POST') {
      let body = '';
      for await (const chunk of req) body += chunk;
      const form = new URLSearchParams(body);
      const entry = codes.get(form.get('code') ?? '');
      const verifier = form.get('code_verifier') ?? '';
      idp.lastCodeVerifier = verifier;
      const challenge = createHash('sha256')
        .update(verifier)
        .digest('base64url');
      if (!entry || entry.challenge !== challenge) {
        json(400, { error: 'invalid_grant' });
        return;
      }
      const idToken = await sign(
        idp.next.signWithOtherKey ? other.privateKey : privateKey,
        {
          nonce: idp.next.nonce ?? entry.nonce,
          name: 'Alice Demo',
          roles: ['shell-user'],
        },
      );
      json(200, {
        access_token: 'opaque-access',
        refresh_token: 'opaque-refresh',
        id_token: idToken,
        token_type: 'Bearer',
        expires_in: 300,
      });
      return;
    }
    json(404, {});
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  idp.issuer = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  idp.close = () => new Promise((resolve) => server.close(() => resolve()));
  return idp;
}

describe('createOidcClient against a real OIDC exchange', () => {
  let idp: FakeIdp;
  let client: OidcClient;
  const redirectUri = 'http://localhost:4000/auth/callback';

  beforeAll(async () => {
    idp = await startFakeIdp();
    client = await createOidcClient(
      { issuer: idp.issuer, clientId: 'shell-bff', clientSecret: 'secret' },
      { allowHttp: true },
    );
  });

  afterAll(() => idp.close());

  async function authorize() {
    const request = await client.createAuthorizationRequest(redirectUri);
    const challenge = request.url.searchParams.get('code_challenge') ?? '';
    await fetch(
      `${idp.issuer}/register-code?code=c1&challenge=${challenge}&nonce=${request.nonce}`,
    );
    const callback = new URL(`${redirectUri}?code=c1&state=${request.state}`);
    return { request, callback };
  }

  beforeEach(() => {
    idp.next = {};
  });

  it('builds an S256 PKCE authorization request with state and nonce', async () => {
    const { request } = await authorize();
    expect(request.url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(request.url.searchParams.get('code_challenge')).not.toBe(
      request.codeVerifier,
    );
    expect(request.url.searchParams.get('state')).toBe(request.state);
    expect(request.url.searchParams.get('nonce')).toBe(request.nonce);
  });

  it('exchanges the code with the PKCE verifier and returns verified claims', async () => {
    const { request, callback } = await authorize();
    const result = await client.exchangeCode(callback, request);
    expect(idp.lastCodeVerifier).toBe(request.codeVerifier);
    expect(result.claims?.['sub']).toBe('user-1');
    expect(result.claims?.['roles']).toEqual(['shell-user']);
    // expiresIn() counts down from the response time, so allow for a second elapsing.
    expect(result.expiresInSeconds).toBeGreaterThanOrEqual(299);
    expect(result.expiresInSeconds).toBeLessThanOrEqual(300);
  });

  it('rejects an ID token whose nonce does not match', async () => {
    const { request, callback } = await authorize();
    idp.next = { nonce: 'attacker-nonce' };
    await expect(client.exchangeCode(callback, request)).rejects.toThrow();
  });

  it('rejects an ID token signed by an unknown key', async () => {
    const { request, callback } = await authorize();
    idp.next = { signWithOtherKey: true };
    await expect(client.exchangeCode(callback, request)).rejects.toThrow();
  });

  it('rejects a callback whose state differs from the request', async () => {
    const { request } = await authorize();
    const forged = new URL(`${redirectUri}?code=c1&state=forged`);
    await expect(client.exchangeCode(forged, request)).rejects.toThrow();
  });

  it('builds the end-session URL with the post-logout redirect', () => {
    const url = client.endSessionUrl('id-token', 'http://localhost:4000/');
    expect(url.href.startsWith(`${idp.issuer}/logout`)).toBe(true);
    expect(url.searchParams.get('post_logout_redirect_uri')).toBe(
      'http://localhost:4000/',
    );
  });
});
