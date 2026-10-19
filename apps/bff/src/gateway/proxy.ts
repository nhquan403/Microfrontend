import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import type { Duplex } from 'node:stream';
import type { Request, RequestHandler, Response } from 'express';
import { createProxyServer } from 'httpxy';
import { logger } from '../logging/logger';

export interface ProxyOptions {
  /** Used in logs only. */
  name: string;
  target: string;
  /** Maps the mount-relative `req.url` to the upstream path. */
  rewritePath?: (path: string) => string;
  /** Rewrites `text/html` responses (e.g. to stamp the CSP nonce). */
  transformHtml?: (html: string, res: Response) => string;
}

/**
 * Reverse proxy for the gateway. Browser cookies never reach an upstream and upstream
 * cookies never reach the browser: the BFF session is the only cookie on this origin.
 */
export function proxyTo(options: ProxyOptions): RequestHandler {
  const proxy = createProxyServer({
    target: options.target,
    changeOrigin: true,
    selfHandleResponse: !!options.transformHtml,
  });

  proxy.on('proxyReq', (proxyReq) => {
    proxyReq.removeHeader('cookie');
    // An uncompressed body is needed to rewrite HTML.
    if (options.transformHtml)
      proxyReq.setHeader('accept-encoding', 'identity');
  });

  proxy.on('proxyRes', (proxyRes, req, res) => {
    delete proxyRes.headers['set-cookie'];
    if (options.transformHtml) {
      relay(proxyRes, req as Request, res as Response, options.transformHtml);
    }
  });

  proxy.on('error', (error, _req, res) => {
    logger.warn('upstream unavailable', { upstream: options.name, error });
    const response = res as ServerResponse | undefined;
    if (response && 'headersSent' in response && !response.headersSent) {
      response.statusCode = 502;
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ error: 'upstream_unavailable' }));
    }
  });

  return (req, res, next) => {
    if (options.rewritePath) req.url = options.rewritePath(req.url);
    proxy.web(req, res).catch(next);
  };
}

/** Copies an upstream response to the client, rewriting HTML bodies. */
function relay(
  proxyRes: IncomingMessage,
  _req: Request,
  res: Response,
  transformHtml: NonNullable<ProxyOptions['transformHtml']>,
): void {
  const isHtml = String(proxyRes.headers['content-type'] ?? '').includes(
    'text/html',
  );
  for (const [key, value] of Object.entries(proxyRes.headers)) {
    if (value === undefined) continue;
    if (isHtml && (key === 'content-length' || key === 'transfer-encoding'))
      continue;
    res.setHeader(key, value);
  }
  res.status(proxyRes.statusCode ?? 502);
  if (!isHtml) {
    proxyRes.pipe(res);
    return;
  }
  const chunks: Buffer[] = [];
  proxyRes.on('data', (chunk: Buffer) => chunks.push(chunk));
  proxyRes.on('end', () => {
    const body = transformHtml(Buffer.concat(chunks).toString('utf8'), res);
    res.setHeader('cache-control', 'no-store');
    res.setHeader('content-length', Buffer.byteLength(body));
    res.end(body);
  });
}

/**
 * Forwards WebSocket upgrades (the Angular dev server's live reload) in `proxy` mode only.
 * Production serves built files and never accepts upgrades.
 */
export function proxyWebSocketUpgrades(server: Server, target: string): void {
  const proxy = createProxyServer({ target, changeOrigin: true, ws: true });
  proxy.on('error', (error) => logger.warn('websocket proxy error', { error }));
  server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    proxy
      .ws(req, socket as never, { target }, head)
      .catch(() => socket.destroy());
  });
}
