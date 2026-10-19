import type { Response } from 'supertest';
import type { BffConfig } from '../config';
import type {
  AuthorizationRequest,
  OidcClient,
  TokenResult,
} from '../auth/oidc-client';

export const PUBLIC_ORIGIN = 'http://localhost:4000';

export function testConfig(overrides: Partial<BffConfig> = {}): BffConfig {
  return {
    port: 0,
    publicOrigin: PUBLIC_ORIGIN,
    insecureLocalhost: true,
    trustProxy: false,
    oidc: {
      issuer: 'http://idp.test/realms/x',
      clientId: 'shell-bff',
      clientSecret: 'test',
    },
    session: {
      secret: 'test-session-secret-that-is-long-enough-123',
      idleMs: 30 * 60_000,
      absoluteMs: 8 * 3_600_000,
    },
    authRateLimitPerMinute: 1000,
    apiUpstreamUrl: 'http://127.0.0.1:1',
    production: false,
    ...overrides,
  };
}

/** Builds an unsigned JWT-shaped string so leak checks have something realistic to look for. */
export function fakeJwt(payload: Record<string, unknown>): string {
  const enc = (o: object) =>
    Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${enc({ alg: 'none' })}.${enc(payload)}.sig`;
}

export class FakeOidc implements OidcClient {
  lastRequest?: AuthorizationRequest;
  exchangeError?: Error;
  refreshError?: Error;
  refreshCalls = 0;
  claims: Record<string, unknown> = {
    sub: 'user-1',
    name: 'Alice Demo',
    email: 'alice@example.test',
    roles: ['shell-user', 'demo-access'],
  };
  expiresInSeconds = 300;

  async createAuthorizationRequest(
    redirectUri: string,
  ): Promise<AuthorizationRequest> {
    const n = Math.random().toString(36).slice(2);
    const url = new URL('http://idp.test/auth');
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('code_challenge_method', 'S256');
    this.lastRequest = {
      url,
      state: `state-${n}`,
      nonce: `nonce-${n}`,
      codeVerifier: `verifier-${n}`,
    };
    return this.lastRequest;
  }

  async exchangeCode(): Promise<TokenResult> {
    if (this.exchangeError) throw this.exchangeError;
    return this.tokens();
  }

  async refresh(): Promise<TokenResult> {
    this.refreshCalls++;
    if (this.refreshError) throw this.refreshError;
    return this.tokens();
  }

  endSessionUrl(
    idTokenHint: string | undefined,
    postLogoutRedirectUri: string,
  ): URL {
    const url = new URL('http://idp.test/logout');
    if (idTokenHint) url.searchParams.set('id_token_hint', 'present');
    url.searchParams.set('post_logout_redirect_uri', postLogoutRedirectUri);
    return url;
  }

  private tokens(): TokenResult {
    return {
      accessToken: fakeJwt({ typ: 'access', sub: this.claims['sub'] }),
      refreshToken: fakeJwt({ typ: 'refresh' }),
      idToken: fakeJwt({ typ: 'id' }),
      expiresInSeconds: this.expiresInSeconds,
      claims: this.claims,
    };
  }
}

/**
 * Minimal cookie jar. supertest's agent drops `Secure` cookies over http, but the BFF
 * always issues them (browsers accept them on localhost), so tests track them explicitly.
 */
export class CookieJar {
  private readonly cookies = new Map<string, string>();

  store(res: Response): void {
    const header = res.headers['set-cookie'] as unknown as string[] | undefined;
    for (const raw of header ?? []) {
      const [pair, ...attrs] = raw.split(';');
      const name = pair.slice(0, pair.indexOf('='));
      const value = pair.slice(pair.indexOf('=') + 1);
      const expired = attrs.some((a) =>
        /^\s*expires=Thu, 01 Jan 1970/i.test(a),
      );
      if (expired || value === '') this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }

  get(name: string): string | undefined {
    return this.cookies.get(name);
  }

  header(): string {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
  }
}

export function setCookieFor(res: Response, name: string): string | undefined {
  const header = res.headers['set-cookie'] as unknown as string[] | undefined;
  return header?.find((c) => c.startsWith(`${name}=`));
}
