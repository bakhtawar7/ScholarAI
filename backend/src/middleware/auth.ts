import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { logger } from '../utils/logger';
import { prisma } from '../utils/prisma';
import { isAdminUser } from '../utils/authorization';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers['authorization'];
  if (!authHeader || typeof authHeader !== 'string') return null;

  const [scheme, value] = authHeader.split(' ');
  if (!value || scheme.toLowerCase() !== 'bearer') return null;
  return value.trim() || null;
}

interface TokenPayload {
  id: string;
  email: string;
  role: string;
  /** Seconds since epoch, set by jwt.sign. Compared against User.passwordChangedAt. */
  iat?: number;
}

function verify(token: string): TokenPayload {
  /**
   * Algorithms are pinned. Without this, jsonwebtoken accepts any algorithm named in the
   * token header, which is the shape of the classic algorithm-confusion attack.
   */
  return jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] }) as TokenPayload;
}

/**
 * `iat` is whole seconds while passwordChangedAt is millisecond-precision, so a token
 * minted in the same second as a password change can carry an `iat` marginally *behind*
 * it. One second of tolerance prevents a freshly-issued token being rejected.
 */
const IAT_TOLERANCE_MS = 1000;

/**
 * Re-checks the account behind a structurally valid token.
 *
 * A JWT is a bearer credential with no revocation of its own, so on its own it stays valid
 * for the full 7-day window regardless of what happens to the account. This closes three
 * gaps that used to persist for up to a week: a deleted account's token kept working, a
 * demoted admin kept administrator access, and a password reset did not end existing
 * sessions. Role is re-read from the database rather than trusted from the token.
 *
 * Cost is one primary-key lookup per authenticated request. Set
 * AUTH_STRICT_SESSION_CHECK=false to skip it and accept the token's claims as-is.
 */
async function loadFreshSession(
  payload: TokenPayload
): Promise<
  { ok: true; user: { id: string; email: string; role: string } } | { ok: false; reason: string; code: string }
> {
  if (!config.strictSessionCheck) {
    return { ok: true, user: { id: payload.id, email: payload.email, role: payload.role || 'STUDENT' } };
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.id },
    select: { id: true, email: true, role: true, passwordChangedAt: true },
  });

  if (!user) {
    return { ok: false, reason: 'This account no longer exists', code: 'ACCOUNT_GONE' };
  }

  if (payload.iat && user.passwordChangedAt.getTime() - IAT_TOLERANCE_MS > payload.iat * 1000) {
    return {
      ok: false,
      reason: 'Your password changed after this session started. Please sign in again.',
      code: 'SESSION_REVOKED',
    };
  }

  return { ok: true, user: { id: user.id, email: user.email, role: user.role || 'STUDENT' } };
}

export const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({ error: 'Access token is required' });
  }

  let decoded: TokenPayload;
  try {
    decoded = verify(token);
  } catch (err: any) {
    // 401 (not 403) for an expired/invalid credential so clients know to re-authenticate.
    const expired = err?.name === 'TokenExpiredError';
    return res.status(401).json({
      error: expired ? 'Access token has expired' : 'Invalid access token',
      code: expired ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID',
    });
  }

  if (!decoded?.id) {
    return res.status(401).json({ error: 'Malformed access token', code: 'TOKEN_INVALID' });
  }

  try {
    const session = await loadFreshSession(decoded);
    if (!session.ok) {
      return res.status(401).json({ error: session.reason, code: session.code });
    }
    req.user = session.user;
    next();
  } catch (err) {
    // A database fault here must not read as "bad credential".
    next(err);
  }
};

export const optionalAuthenticateToken = async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
  const token = extractToken(req);
  if (!token) return next();

  try {
    const decoded = verify(token);
    if (decoded?.id) {
      const session = await loadFreshSession(decoded);
      // Anonymous access is allowed on these routes, so a revoked or deleted account
      // simply proceeds unauthenticated rather than failing the request.
      if (session.ok) req.user = session.user;
    }
  } catch {
    // Ignore a bad token on routes that permit anonymous access.
  }
  next();
};

/**
 * Gate for catalogue mutation, verification overrides and automation control.
 * Admin status comes from the shared isAdminUser rule (JWT role or ADMIN_EMAILS), which
 * the serialised user payload uses too, so the API and the UI cannot disagree.
 * Must be mounted after authenticateToken.
 */
export const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!isAdminUser(req.user)) {
    logger.warn('Blocked non-admin access to privileged route', {
      userId: req.user.id,
      path: req.originalUrl,
      method: req.method,
    });
    return res.status(403).json({ error: 'Administrator privileges are required for this operation' });
  }

  next();
};
