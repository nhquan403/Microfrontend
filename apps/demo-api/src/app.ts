import express, { type Express, type RequestHandler } from 'express';
import type { JWTPayload } from 'jose';

/** Verifies a bearer token and returns its claims, or throws. */
export type VerifyToken = (token: string) => Promise<JWTPayload>;

declare module 'express-serve-static-core' {
  interface Locals {
    claims?: JWTPayload & { roles?: unknown };
  }
}

const ITEMS = [
  {
    id: 'alpha',
    name: 'Alpha',
    description: 'First demo item served by demo-api.',
  },
  {
    id: 'beta',
    name: 'Beta',
    description: 'Second demo item served by demo-api.',
  },
];

function requireBearer(verify: VerifyToken): RequestHandler {
  return async (req, res, next) => {
    const header = req.get('authorization') ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      res.status(401).json({ error: 'missing_token' });
      return;
    }
    try {
      res.locals.claims = await verify(token);
      next();
    } catch {
      res.status(401).json({ error: 'invalid_token' });
    }
  };
}

function requireRole(role: string): RequestHandler {
  return (_req, res, next) => {
    const roles = res.locals.claims?.roles;
    if (!Array.isArray(roles) || !roles.includes(role)) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }
    next();
  };
}

/** Sample upstream behind the BFF. It trusts nothing but a valid access token. */
export function createApi(verify: VerifyToken): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));
  app.use('/api', requireBearer(verify), requireRole('demo-access'));

  app.get('/api/hello', (_req, res) => {
    res.json({
      message: 'Hello from demo-api',
      subject: res.locals.claims?.sub,
      items: ITEMS,
    });
  });

  app.post('/api/echo', (req, res) => {
    res.json({
      echoed: req.body ?? null,
      receivedAt: new Date().toISOString(),
    });
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'not_found' });
  });
  return app;
}
