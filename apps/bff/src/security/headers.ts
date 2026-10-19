import { randomBytes } from 'node:crypto';
import type { RequestHandler } from 'express';
import helmet from 'helmet';

export const CSP_REPORT_PATH = '/csp-report';

declare module 'express-serve-static-core' {
  interface Locals {
    cspNonce?: string;
  }
}

/**
 * Per-request nonce plus the full security header set. Scripts and runtime-inserted
 * styles must carry the nonce; there is deliberately no 'unsafe-inline' or 'unsafe-eval'.
 */
export function securityHeaders(): RequestHandler[] {
  const nonce: RequestHandler = (_req, res, next) => {
    res.locals.cspNonce = randomBytes(16).toString('base64');
    next();
  };
  const nonceSource = (_req: unknown, res: unknown) =>
    `'nonce-${(res as { locals: { cspNonce: string } }).locals.cspNonce}'`;

  const headers = helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", nonceSource],
        styleSrc: ["'self'", nonceSource],
        imgSrc: ["'self'", 'data:'],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        reportUri: [CSP_REPORT_PATH],
      },
    },
    strictTransportSecurity: { maxAge: 31_536_000, includeSubDomains: true },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
    crossOriginEmbedderPolicy: false,
    xFrameOptions: { action: 'deny' },
  });

  const permissions: RequestHandler = (_req, res, next) => {
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
    );
    next();
  };

  return [nonce, headers, permissions];
}

const NONCE_PLACEHOLDER = /__CSP_NONCE__/g;

/**
 * Stamps the request nonce into an HTML document: the `ngCspNonce` placeholder used by
 * Angular for runtime styles, and every `<script>`/`<style>` tag that lacks one.
 */
export function injectNonce(html: string, nonce: string): string {
  return html
    .replace(NONCE_PLACEHOLDER, nonce)
    .replace(/<script\b(?![^>]*\bnonce=)/gi, `<script nonce="${nonce}"`)
    .replace(/<style\b(?![^>]*\bnonce=)/gi, `<style nonce="${nonce}"`);
}
