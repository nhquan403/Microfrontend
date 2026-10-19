import rateLimit from 'express-rate-limit';
import type { RequestHandler } from 'express';

export function authRateLimit(limitPerMinute: number): RequestHandler {
  return rateLimit({
    windowMs: 60_000,
    limit: limitPerMinute,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'too_many_requests' },
  });
}
