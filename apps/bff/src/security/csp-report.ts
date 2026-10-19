import express, { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { logger } from '../logging/logger';
import { CSP_REPORT_PATH } from './headers';

/** Receives browser CSP violation reports. Mounted before session and CSRF handling. */
export function cspReportRoute(): Router {
  const router = Router();
  router.post(
    CSP_REPORT_PATH,
    rateLimit({
      windowMs: 60_000,
      limit: 30,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
    }),
    express.json({
      type: [
        'application/csp-report',
        'application/reports+json',
        'application/json',
      ],
      limit: '8kb',
    }),
    (req, res) => {
      const report = (req.body?.['csp-report'] ?? req.body) as Record<
        string,
        unknown
      >;
      logger.warn('csp violation', {
        directive:
          report?.['violated-directive'] ?? report?.['effective-directive'],
        blocked: report?.['blocked-uri'],
        page: report?.['document-uri'],
      });
      res.status(204).end();
    },
  );
  return router;
}
