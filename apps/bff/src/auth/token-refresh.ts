import type { Request } from 'express';
import { logger } from '../logging/logger';
import {
  destroySession,
  saveSession,
  type SessionTokens,
} from '../session/session';
import type { OidcClient, TokenResult } from './oidc-client';

/** Refresh this long before expiry so upstream calls never carry an expired token. */
const REFRESH_SKEW_MS = 30_000;

export function toSessionTokens(
  result: TokenResult,
  previous: SessionTokens | undefined,
  now: number,
): SessionTokens {
  return {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken ?? previous?.refreshToken,
    idToken: result.idToken ?? previous?.idToken,
    expiresAt: now + (result.expiresInSeconds ?? 60) * 1000,
  };
}

export class TokenProvider {
  /** One in-flight refresh per session so parallel requests do not race the rotating refresh token. */
  private readonly inFlight = new Map<string, Promise<string | undefined>>();

  constructor(
    private readonly oidc: OidcClient,
    private readonly now: () => number = Date.now,
  ) {}

  /** Returns a usable access token, refreshing server-side when needed. Undefined means the session ended. */
  async accessToken(req: Request): Promise<string | undefined> {
    const tokens = req.session.tokens;
    if (!tokens) return undefined;
    if (tokens.expiresAt - REFRESH_SKEW_MS > this.now())
      return tokens.accessToken;

    const pending = this.inFlight.get(req.sessionID);
    if (pending) return pending;

    const refresh = this.refresh(req).finally(() =>
      this.inFlight.delete(req.sessionID),
    );
    this.inFlight.set(req.sessionID, refresh);
    return refresh;
  }

  private async refresh(req: Request): Promise<string | undefined> {
    const current = req.session.tokens;
    if (!current?.refreshToken) {
      await destroySession(req);
      return undefined;
    }
    try {
      const result = await this.oidc.refresh(current.refreshToken);
      req.session.tokens = toSessionTokens(result, current, this.now());
      await saveSession(req);
      return req.session.tokens.accessToken;
    } catch (error) {
      logger.warn('token refresh failed; ending session', { error });
      await destroySession(req);
      return undefined;
    }
  }
}
