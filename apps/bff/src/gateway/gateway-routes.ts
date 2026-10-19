import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import express, { Router, type RequestHandler } from 'express';
import { requireAuth, requireRoles } from '../auth/require-auth';
import type { TokenProvider } from '../auth/token-refresh';
import { registryFor, type RemoteEntry } from '../registry/registry';
import { injectNonce } from '../security/headers';
import { proxyTo } from './proxy';

export type ServeMode = 'static' | 'proxy';

export interface GatewayOptions {
  mode: ServeMode;
  registry: RemoteEntry[];
  tokens: TokenProvider;
  apiUpstreamUrl: string;
  shellDevUrl?: string;
  shellStaticDir: string;
}

export function registryRoutes(registry: RemoteEntry[]): Router {
  const router = Router();
  router.get('/registry', requireAuth, (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(registryFor(registry, req.session.user?.roles ?? []));
  });
  return router;
}

/**
 * `/apps/<name>/*` serves a remote's files, but only to users holding its roles. The name is
 * matched against the registry; request input never becomes a filesystem path or proxy target.
 */
export function appsRoutes(options: GatewayOptions): Router {
  const router = Router();
  for (const entry of options.registry) {
    let serve: RequestHandler;
    if (options.mode === 'static') {
      if (!entry.staticDir)
        throw new Error(`registry: "${entry.name}" has no staticDir`);
      serve = express.static(resolve(entry.staticDir), {
        index: false,
        fallthrough: false,
        setHeaders: (res, path) => {
          // The entry file names hashed chunks; it must be revalidated on every load.
          if (path.endsWith('remoteEntry.json'))
            res.setHeader('Cache-Control', 'no-cache');
        },
      });
    } else {
      if (!entry.devUrl)
        throw new Error(`registry: "${entry.name}" has no devUrl`);
      serve = proxyTo({ name: entry.name, target: entry.devUrl });
    }
    router.use(
      `/apps/${entry.name}`,
      requireAuth,
      requireRoles(entry.requiredRoles),
      serve,
    );
  }
  router.use('/apps', (_req, res) => {
    res.status(404).json({ error: 'unknown_app' });
  });
  return router;
}

/** `/api/*` forwards to the upstream with the session's access token; cookies never leave the BFF. */
export function apiRoutes(options: GatewayOptions): Router {
  const router = Router();
  const attachToken: RequestHandler = async (req, res, next) => {
    const token = await options.tokens.accessToken(req);
    if (!token) {
      res.status(401).json({ error: 'unauthenticated' });
      return;
    }
    req.headers['authorization'] = `Bearer ${token}`;
    delete req.headers['cookie'];
    delete req.headers['x-xsrf-token'];
    next();
  };
  router.use(
    '/api',
    requireAuth,
    attachToken,
    proxyTo({
      name: 'api',
      target: options.apiUpstreamUrl,
      rewritePath: (path) => `/api${path}`,
    }),
  );
  return router;
}

/** Serves the shell: hashed assets as files, every other GET as `index.html` with the CSP nonce. */
export function shellRoutes(options: GatewayOptions): Router {
  const router = Router();
  if (options.mode === 'static') {
    const dir = resolve(options.shellStaticDir);
    const template = readFileSync(resolve(dir, 'index.html'), 'utf8');
    router.use(express.static(dir, { index: false }));
    router.get(/.*/, requireAuth, (_req, res) => {
      res.set('Cache-Control', 'no-store');
      res.type('html').send(injectNonce(template, res.locals.cspNonce ?? ''));
    });
    return router;
  }

  if (!options.shellDevUrl)
    throw new Error('SHELL_DEV_URL is required in proxy mode');
  const proxy = proxyTo({
    name: 'shell',
    target: options.shellDevUrl,
    transformHtml: (html, res) => injectNonce(html, res.locals.cspNonce ?? ''),
  });
  const htmlNavigationNeedsAuth: RequestHandler = (req, res, next) => {
    const accept = req.get('accept') ?? '';
    if (req.method === 'GET' && accept.includes('text/html')) {
      requireAuth(req, res, next);
      return;
    }
    next();
  };
  router.use(htmlNavigationNeedsAuth, proxy);
  return router;
}

export function gatewayRoutes(options: GatewayOptions): Router[] {
  return [
    registryRoutes(options.registry),
    appsRoutes(options),
    apiRoutes(options),
    shellRoutes(options),
  ];
}
