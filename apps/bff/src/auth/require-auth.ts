import type { Request, RequestHandler } from 'express';
import { hasAllRoles } from './roles';

function isPageNavigation(req: Request): boolean {
  return (
    req.method === 'GET' &&
    (req.get('sec-fetch-mode') === 'navigate' ||
      (req.get('accept') ?? '').includes('text/html'))
  );
}

/** 401 for API calls; page navigations are sent to the login flow and come back afterwards. */
export const requireAuth: RequestHandler = (req, res, next) => {
  if (req.session?.user && req.session.tokens) {
    next();
    return;
  }
  if (isPageNavigation(req)) {
    res.redirect(
      302,
      `/auth/login?returnTo=${encodeURIComponent(req.originalUrl)}`,
    );
    return;
  }
  res.status(401).json({ error: 'unauthenticated' });
};

export function requireRoles(roles: readonly string[]): RequestHandler {
  return (req, res, next) => {
    const user = req.session?.user;
    if (!user) {
      res.status(401).json({ error: 'unauthenticated' });
      return;
    }
    if (!hasAllRoles(user.roles, roles)) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }
    next();
  };
}
