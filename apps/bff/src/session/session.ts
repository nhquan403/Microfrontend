import type { RequestHandler } from 'express';
import session from 'express-session';
import type { BffConfig } from '../config';
import { ExpressSessionStoreAdapter, type SessionStore } from './session-store';

export const SESSION_COOKIE = '__Host-sid';

export interface SessionUser {
  sub: string;
  name: string;
  email?: string;
  roles: string[];
}

export interface SessionTokens {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  /** Epoch milliseconds at which the access token expires. */
  expiresAt: number;
}

/** Short-lived state kept between `/auth/login` and `/auth/callback`. */
export interface PendingLogin {
  state: string;
  nonce: string;
  codeVerifier: string;
  returnTo: string;
  startedAt: number;
}

declare module 'express-session' {
  interface SessionData {
    createdAt?: number;
    user?: SessionUser;
    tokens?: SessionTokens;
    pendingLogin?: PendingLogin;
    csrfToken?: string;
  }
}

/**
 * Browsers accept `Secure` cookies from http://localhost, but express-session refuses to
 * emit them on a non-TLS request. In local dev only, mark loopback requests as https so the
 * `__Host-` cookie is still issued with `Secure`. Never active for a non-localhost origin.
 */
export function localhostSecureShim(config: BffConfig): RequestHandler {
  return (req, _res, next) => {
    if (config.insecureLocalhost) {
      req.headers['x-forwarded-proto'] = 'https';
    }
    next();
  };
}

export function createSessionMiddleware(
  config: BffConfig,
  store: SessionStore,
): RequestHandler {
  return session({
    name: SESSION_COOKIE,
    secret: config.session.secret,
    store: new ExpressSessionStoreAdapter(store, config.session.idleMs),
    resave: false,
    saveUninitialized: false,
    rolling: true,
    unset: 'destroy',
    proxy: config.insecureLocalhost ? true : undefined,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: config.session.idleMs,
    },
  });
}

/** Ends sessions older than the absolute lifetime, regardless of activity. */
export function absoluteTimeout(
  config: BffConfig,
  now: () => number = Date.now,
): RequestHandler {
  return (req, _res, next) => {
    const createdAt = req.session?.createdAt;
    if (
      createdAt !== undefined &&
      now() - createdAt > config.session.absoluteMs
    ) {
      req.session.destroy((err) => next(err));
      return;
    }
    next();
  };
}

export function regenerateSession(
  req: Parameters<RequestHandler>[0],
): Promise<void> {
  return new Promise((resolve, reject) =>
    req.session.regenerate((err) => (err ? reject(err) : resolve())),
  );
}

export function saveSession(req: Parameters<RequestHandler>[0]): Promise<void> {
  return new Promise((resolve, reject) =>
    req.session.save((err) => (err ? reject(err) : resolve())),
  );
}

export function destroySession(
  req: Parameters<RequestHandler>[0],
): Promise<void> {
  return new Promise((resolve, reject) =>
    req.session.destroy((err) => (err ? reject(err) : resolve())),
  );
}
