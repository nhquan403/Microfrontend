import express, { type Express, type Router } from 'express';
import { authRoutes } from './auth/auth-routes';
import type { OidcClient } from './auth/oidc-client';
import type { BffConfig } from './config';
import { logger } from './logging/logger';
import { cspReportRoute } from './security/csp-report';
import { csrfProtection } from './security/csrf';
import { securityHeaders } from './security/headers';
import { authRateLimit } from './security/rate-limit';
import {
  absoluteTimeout,
  createSessionMiddleware,
  localhostSecureShim,
} from './session/session';
import type { SessionStore } from './session/session-store';

export interface AppDeps {
  config: BffConfig;
  oidc: OidcClient;
  store: SessionStore;
  /** Mounted after session and CSRF handling; used by the gateway routes. */
  routes?: Router[];
  now?: () => number;
}

export function createApp({
  config,
  oidc,
  store,
  routes = [],
  now = Date.now,
}: AppDeps): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  app.use(securityHeaders());
  // Browsers send CSP reports without cookies or CSRF headers.
  app.use(cspReportRoute());
  app.use(localhostSecureShim(config));
  app.use(createSessionMiddleware(config, store));
  app.use(absoluteTimeout(config, now));
  app.use(csrfProtection(config.publicOrigin));
  app.use(
    '/auth',
    authRateLimit(config.authRateLimitPerMinute),
    authRoutes(config, oidc, now),
  );
  for (const router of routes) app.use(router);

  app.use(
    (
      err: unknown,
      req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      // Client errors raised by middleware (e.g. express.static's 403/404) keep their status.
      const status = (err as { status?: number })?.status;
      if (typeof status === 'number' && status >= 400 && status < 500) {
        if (!res.headersSent)
          res.status(status).json({ error: 'request_rejected' });
        return;
      }
      logger.error('unhandled request error', {
        error: err,
        path: req.path,
        method: req.method,
      });
      if (!res.headersSent) res.status(500).json({ error: 'internal_error' });
    },
  );
  return app;
}
