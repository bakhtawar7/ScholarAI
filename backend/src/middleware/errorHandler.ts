import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';
import { config } from '../config';
import { captureException } from '../utils/sentry';

/** Prisma error codes we can map to a meaningful HTTP status. */
const PRISMA_STATUS: Record<string, { status: number; message: string }> = {
  P2002: { status: 409, message: 'A record with these unique values already exists.' },
  P2003: { status: 400, message: 'Referenced record does not exist.' },
  P2025: { status: 404, message: 'Record not found.' },
};

/**
 * Prisma tags its own error classes, so a database fault can be told apart from an
 * application bug without importing the client here. `P####` covers the known request
 * errors; the class name catches initialisation, panic and validation failures.
 */
function isDatabaseError(err: any): boolean {
  if (typeof err?.code === 'string' && /^P\d{4}$/.test(err.code)) return true;
  return typeof err?.name === 'string' && err.name.startsWith('Prisma');
}

export const errorHandler = (err: any, req: Request, res: Response, _next: NextFunction) => {
  // Zod failures that escaped validateRequest (e.g. schema.parse inside a controller)
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation Error',
      details: err.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
    });
  }

  const prismaMapping = err?.code ? PRISMA_STATUS[err.code] : undefined;
  const status = err.statusCode || err.status || (prismaMapping ? prismaMapping.status : 500);

  // Never surface internal exception text on a 500 — it leaks file paths, SQL
  // fragments and library internals. Client errors carry their own safe message.
  const isClientError = status >= 400 && status < 500;
  const message = prismaMapping
    ? prismaMapping.message
    : isClientError
      ? err.message || 'Request could not be processed'
      : 'Internal Server Error';

  const logMeta = {
    method: req.method,
    path: req.originalUrl,
    status,
    userId: (req as any).user?.id,
    code: err?.code,
    message: err?.message,
  };

  if (status >= 500) {
    logger.error('Unhandled server error', { ...logMeta, stack: err?.stack });
  } else {
    logger.warn('Request rejected', logMeta);
  }

  /**
   * Report server faults only.
   *
   * 4xx responses are the API working as designed — a validation failure or a wrong
   * password is not an incident, and forwarding them would bury real faults. The route
   * and status go with the event; the request body never does (it can hold credentials,
   * CV text or SOP drafts), which `scrubEvent` enforces independently.
   */
  if (status >= 500) {
    captureException(err, {
      area: isDatabaseError(err) ? 'database' : 'api',
      userId: (req as any).user?.id,
      level: 'error',
      extra: {
        method: req.method,
        route: req.route?.path || req.originalUrl.split('?')[0],
        status,
        code: err?.code,
        requestId: (req as any).requestId,
      },
    });
  }

  res.status(status).json({
    error: message,
    ...(err.details ? { details: err.details } : {}),
    ...(config.isProduction ? {} : { stack: err?.stack }),
  });
};

/** Terminal 404 for unmatched API paths so clients always receive JSON. */
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
};
