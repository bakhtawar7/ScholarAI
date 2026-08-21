import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { logger } from '../utils/logger';

/**
 * Baseline security headers. Implemented directly rather than via helmet to avoid
 * adding a runtime dependency; the set below covers the headers that matter for a
 * JSON API with a separately-hosted SPA.
 */
export const securityHeaders = (_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  // API responses are never a document context, so a maximally restrictive CSP is safe.
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  // Do not advertise the framework.
  res.removeHeader('X-Powered-By');
  next();
};

/**
 * Assigns a request id and logs completion with duration. The id is echoed back so
 * a user-reported failure can be traced to a specific log line.
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const incoming = req.headers['x-request-id'];
  const requestId = typeof incoming === 'string' && incoming.length <= 64 ? incoming : randomUUID();
  (req as any).requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const meta = {
      requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Math.round(durationMs),
      userId: (req as any).user?.id,
    };

    if (res.statusCode >= 500) logger.error('Request failed', meta);
    else if (res.statusCode >= 400) logger.warn('Request error', meta);
    else logger.debug('Request completed', meta);
  });

  next();
};
