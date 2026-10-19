import type { Request } from 'express';
import { FakeOidc } from '../testing/test-helpers';
import { TokenProvider } from './token-refresh';

function fakeRequest(expiresAt: number, refreshToken: string | null = 'rt') {
  const session = {
    tokens: {
      accessToken: 'old-access',
      refreshToken: refreshToken ?? undefined,
      idToken: 'id',
      expiresAt,
    },
    destroyed: false,
    save: (cb: (err?: unknown) => void) => cb(),
    destroy(cb: (err?: unknown) => void) {
      this.destroyed = true;
      delete (this as { tokens?: unknown }).tokens;
      cb();
    },
  };
  return { sessionID: 'sid-1', session } as unknown as Request & {
    session: typeof session;
  };
}

describe('TokenProvider', () => {
  const now = 1_000_000;

  it('returns the current token while it is comfortably valid', async () => {
    const oidc = new FakeOidc();
    const provider = new TokenProvider(oidc, () => now);
    const req = fakeRequest(now + 120_000);
    expect(await provider.accessToken(req)).toBe('old-access');
    expect(oidc.refreshCalls).toBe(0);
  });

  it('refreshes once for concurrent callers when the token is about to expire', async () => {
    const oidc = new FakeOidc();
    const provider = new TokenProvider(oidc, () => now);
    const req = fakeRequest(now + 10_000);
    const [a, b] = await Promise.all([
      provider.accessToken(req),
      provider.accessToken(req),
    ]);
    expect(oidc.refreshCalls).toBe(1);
    expect(a).toBe(b);
    expect(a).not.toBe('old-access');
    expect(req.session.tokens?.expiresAt).toBe(now + 300_000);
  });

  it('ends the session when the refresh fails', async () => {
    const oidc = new FakeOidc();
    oidc.refreshError = new Error('invalid_grant');
    const provider = new TokenProvider(oidc, () => now);
    const req = fakeRequest(now - 1);
    expect(await provider.accessToken(req)).toBeUndefined();
    expect(req.session.destroyed).toBe(true);
  });

  it('ends the session when there is no refresh token', async () => {
    const provider = new TokenProvider(new FakeOidc(), () => now);
    const req = fakeRequest(now - 1, null);
    expect(await provider.accessToken(req)).toBeUndefined();
    expect(req.session.destroyed).toBe(true);
  });
});
