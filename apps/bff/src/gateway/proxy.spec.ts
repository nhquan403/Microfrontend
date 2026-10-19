import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import request from 'supertest';
import { proxyTo } from './proxy';

let upstream: Server;
let target: string;
let seen: { url?: string; headers?: IncomingHttpHeaders } = {};

beforeAll(async () => {
  upstream = createServer((req, res) => {
    seen = { url: req.url, headers: req.headers };
    if (req.url?.startsWith('/page')) {
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'set-cookie': 'upstream=1',
      });
      res.end(
        '<html><script src="main.js"></script><sh-root ngCspNonce="__CSP_NONCE__"></sh-root></html>',
      );
      return;
    }
    res.writeHead(200, {
      'content-type': 'application/javascript',
      'set-cookie': 'upstream=1',
    });
    res.end('console.log(1)');
  });
  await new Promise<void>((resolve) =>
    upstream.listen(0, '127.0.0.1', resolve),
  );
  target = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`;
});

afterAll(() => new Promise((resolve) => upstream.close(resolve)));

function app(options: Partial<Parameters<typeof proxyTo>[0]> = {}) {
  const a = express();
  a.use((_req, res, next) => {
    res.locals.cspNonce = 'n0nce';
    next();
  });
  a.use('/mount', proxyTo({ name: 'test', target, ...options }));
  return a;
}

describe('proxyTo', () => {
  it('strips cookies in both directions and rewrites the path', async () => {
    const res = await request(app({ rewritePath: (p) => `/api${p}` }))
      .get('/mount/x.js')
      .set('Cookie', '__Host-sid=secret');
    expect(res.status).toBe(200);
    expect(seen.url).toBe('/api/x.js');
    expect(seen.headers?.cookie).toBeUndefined();
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('stamps the nonce into proxied HTML and fixes the length', async () => {
    const res = await request(
      app({
        transformHtml: (html, r) =>
          html.replaceAll('__CSP_NONCE__', r.locals.cspNonce ?? ''),
      }),
    ).get('/mount/page');
    expect(res.status).toBe(200);
    expect(res.text).toContain('ngCspNonce="n0nce"');
    expect(Number(res.headers['content-length'])).toBe(
      Buffer.byteLength(res.text),
    );
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(seen.headers?.['accept-encoding']).toBe('identity');
  });

  it('passes non-HTML bodies through untouched when transforming', async () => {
    const res = await request(app({ transformHtml: () => 'replaced' })).get(
      '/mount/x.js',
    );
    expect(res.text).toBe('console.log(1)');
  });

  it('answers 502 when the upstream is down', async () => {
    const res = await request(proxyApp('http://127.0.0.1:1')).get('/mount/x');
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: 'upstream_unavailable' });
  });
});

function proxyApp(deadTarget: string) {
  const a = express();
  a.use('/mount', proxyTo({ name: 'dead', target: deadTarget }));
  return a;
}
