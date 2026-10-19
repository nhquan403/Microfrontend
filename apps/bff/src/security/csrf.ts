import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, RequestHandler, Response } from 'express';

export const CSRF_COOKIE = 'XSRF-TOKEN';
export const CSRF_HEADER = 'x-xsrf-token';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Ensures the session has a CSRF token and mirrors it into a JS-readable cookie so
 * Angular's HttpClient can echo it back in the `X-XSRF-TOKEN` header (double submit).
 * The cookie is not a secret: an attacker on another origin can neither read it nor
 * set the matching header.
 */
export function issueCsrfToken(req: Request, res: Response): void {
  if (!req.session.csrfToken) {
    req.session.csrfToken = randomBytes(32).toString('base64url');
  }
  res.cookie(CSRF_COOKIE, req.session.csrfToken, {
    httpOnly: false,
    secure: true,
    sameSite: 'strict',
    path: '/',
  });
}

function sameToken(expected: string, actual: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(actual);
  return a.length === b.length && timingSafeEqual(a, b);
}

function requestOrigin(req: Request): string | undefined {
  const origin = req.get('origin');
  if (origin) return origin;
  const referer = req.get('referer');
  if (!referer) return undefined;
  try {
    return new URL(referer).origin;
  } catch {
    return undefined;
  }
}

/** Rejects state-changing requests that lack a matching CSRF token or come from another origin. */
export function csrfProtection(publicOrigin: string): RequestHandler {
  return (req, res, next) => {
    if (SAFE_METHODS.has(req.method)) {
      next();
      return;
    }
    if (requestOrigin(req) !== publicOrigin) {
      res.status(403).json({ error: 'origin_mismatch' });
      return;
    }
    const expected = req.session?.csrfToken;
    const actual = req.get(CSRF_HEADER);
    if (!expected || !actual || !sameToken(expected, actual)) {
      res.status(403).json({ error: 'csrf_token_invalid' });
      return;
    }
    next();
  };
}
