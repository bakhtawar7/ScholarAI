import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

/** Per-bucket stores keep one limiter's traffic from consuming another's budget. */
const stores = new Map<string, Map<string, RateLimitRecord>>();

function storeFor(bucket: string): Map<string, RateLimitRecord> {
  let store = stores.get(bucket);
  if (!store) {
    store = new Map();
    stores.set(bucket, store);
  }
  return store;
}

const sweeper = setInterval(() => {
  const now = Date.now();
  for (const store of stores.values()) {
    for (const [key, record] of store.entries()) {
      if (now > record.resetTime) store.delete(key);
    }
  }
}, 60_000);
// Never hold the event loop open just for cleanup.
sweeper.unref?.();

export interface RateLimitOptions {
  windowMs?: number;
  maxRequests?: number;
  message?: string;
  /** Namespace for the counter store. Limiters sharing a bucket share counters. */
  bucket?: string;
  /** Override the identity used for counting (defaults to user id, then IP). */
  keyGenerator?: (req: Request) => string;
}

function clientIp(req: Request): string {
  if (config.trustProxy) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      return forwarded.split(',')[0].trim();
    }
  }
  return req.ip || req.socket?.remoteAddress || 'unknown-client';
}

/**
 * Fixed-window in-memory rate limiter.
 *
 * Note: counters are per-process. Behind more than one instance, either enable
 * sticky sessions or move this to a shared store (Redis) — see the deployment notes.
 */
export function createRateLimiter(options: RateLimitOptions = {}) {
  const windowMs = options.windowMs || 60_000;
  const maxRequests = options.maxRequests || 45;
  const message = options.message || 'Too many requests. Please slow down and try again shortly.';
  const store = storeFor(options.bucket || 'default');

  return (req: Request, res: Response, next: NextFunction) => {
    const identifier = options.keyGenerator ? options.keyGenerator(req) : (req as any).user?.id || clientIp(req);

    const now = Date.now();
    const record = store.get(identifier);

    if (!record || now > record.resetTime) {
      store.set(identifier, { count: 1, resetTime: now + windowMs });
      res.setHeader('X-RateLimit-Limit', String(maxRequests));
      res.setHeader('X-RateLimit-Remaining', String(maxRequests - 1));
      return next();
    }

    if (record.count >= maxRequests) {
      const retryAfterSec = Math.max(1, Math.ceil((record.resetTime - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      res.setHeader('X-RateLimit-Limit', String(maxRequests));
      res.setHeader('X-RateLimit-Remaining', '0');
      return res.status(429).json({ error: message, retryAfterSeconds: retryAfterSec });
    }

    record.count += 1;
    res.setHeader('X-RateLimit-Limit', String(maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, maxRequests - record.count)));
    next();
  };
}

/** Broad ceiling applied to the whole API surface. */
export const globalRateLimiter = createRateLimiter({
  bucket: 'global',
  windowMs: 60_000,
  maxRequests: Number(process.env.RATE_LIMIT_GLOBAL_MAX) || 300,
  message: 'Request rate limit exceeded. Please wait a moment and try again.',
});

/**
 * Credential endpoints are keyed on IP (there is no authenticated user yet) and
 * kept deliberately tight to slow credential stuffing and account enumeration.
 */
export const authRateLimiter = createRateLimiter({
  bucket: 'auth',
  windowMs: 15 * 60_000,
  maxRequests: Number(process.env.RATE_LIMIT_AUTH_MAX) || 20,
  message: 'Too many authentication attempts. Please try again in a few minutes.',
  keyGenerator: (req) => clientIp(req),
});

/** LLM-backed chat: each call can fan out into several model round-trips. */
export const chatRateLimiter = createRateLimiter({
  bucket: 'chat',
  windowMs: 60_000,
  maxRequests: Number(process.env.RATE_LIMIT_CHAT_MAX) || 20,
  message: 'Chat message rate limit reached. Please wait a few seconds before sending another message.',
});

/** Document analysis and SOP/CV endpoints — expensive parsing plus model calls. */
export const aiHeavyRateLimiter = createRateLimiter({
  bucket: 'ai-heavy',
  windowMs: 60_000,
  maxRequests: Number(process.env.RATE_LIMIT_AI_MAX) || 12,
  message: 'AI analysis rate limit reached. Please wait a moment before submitting another document.',
});
