import { Router } from 'express';
import type { BffConfig } from '../config';
import { logger } from '../logging/logger';
import { CSRF_COOKIE, issueCsrfToken } from '../security/csrf';
import {
  destroySession,
  regenerateSession,
  saveSession,
  SESSION_COOKIE,
} from '../session/session';
import type { OidcClient } from './oidc-client';
import { requireAuth } from './require-auth';
import { safeReturnTo } from './return-to';
import { rolesFromClaims } from './roles';
import { toSessionTokens } from './token-refresh';

/** A login must complete within this window after `/auth/login`. */
const PENDING_LOGIN_TTL_MS = 10 * 60_000;

export function authRoutes(
  config: BffConfig,
  oidc: OidcClient,
  now: () => number = Date.now,
): Router {
  const router = Router();
  const redirectUri = `${config.publicOrigin}/auth/callback`;

  router.get('/login', async (req, res) => {
    const request = await oidc.createAuthorizationRequest(redirectUri);
    req.session.pendingLogin = {
      state: request.state,
      nonce: request.nonce,
      codeVerifier: request.codeVerifier,
      returnTo: safeReturnTo(req.query['returnTo'], config.publicOrigin),
      startedAt: now(),
    };
    await saveSession(req);
    res.redirect(302, request.url.href);
  });

  router.get('/callback', async (req, res) => {
    const pending = req.session.pendingLogin;
    delete req.session.pendingLogin;

    if (typeof req.query['error'] === 'string') {
      logger.warn('identity provider returned an error', {
        error: req.query['error'],
      });
      res.status(400).type('text/plain').send('Sign-in was not completed.');
      return;
    }
    if (!pending || now() - pending.startedAt > PENDING_LOGIN_TTL_MS) {
      res
        .status(400)
        .type('text/plain')
        .send('Sign-in session expired. Please try again.');
      return;
    }
    if (req.query['state'] !== pending.state) {
      res.status(400).type('text/plain').send('Invalid sign-in state.');
      return;
    }

    let result;
    try {
      // openid-client re-checks state, verifies PKCE, the ID token signature and the nonce.
      result = await oidc.exchangeCode(
        new URL(req.originalUrl, config.publicOrigin),
        {
          state: pending.state,
          nonce: pending.nonce,
          codeVerifier: pending.codeVerifier,
        },
      );
    } catch (error) {
      logger.warn('authorization code exchange failed', { error });
      res.status(400).type('text/plain').send('Sign-in could not be verified.');
      return;
    }

    const claims = result.claims ?? {};
    // A new session id after login prevents session fixation.
    await regenerateSession(req);
    req.session.createdAt = now();
    req.session.user = {
      sub: String(claims['sub']),
      name: String(
        claims['name'] ?? claims['preferred_username'] ?? claims['sub'],
      ),
      email: typeof claims['email'] === 'string' ? claims['email'] : undefined,
      roles: rolesFromClaims(claims),
    };
    req.session.tokens = toSessionTokens(result, undefined, now());
    issueCsrfToken(req, res);
    await saveSession(req);
    logger.info('user signed in', { sub: req.session.user.sub });
    res.redirect(302, pending.returnTo);
  });

  router.get('/me', requireAuth, (req, res) => {
    issueCsrfToken(req, res);
    res.set('Cache-Control', 'no-store');
    res.json(req.session.user);
  });

  router.post('/logout', async (req, res) => {
    const idToken = req.session.tokens?.idToken;
    const logoutUrl = oidc.endSessionUrl(
      idToken,
      `${config.publicOrigin}/`,
    ).href;
    await destroySession(req);
    res.clearCookie(SESSION_COOKIE, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
    });
    res.clearCookie(CSRF_COOKIE, {
      path: '/',
      secure: true,
      sameSite: 'strict',
    });
    res.set('Cache-Control', 'no-store');
    res.json({ logoutUrl });
  });

  return router;
}
