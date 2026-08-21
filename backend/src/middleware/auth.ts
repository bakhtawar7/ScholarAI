import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { logger } from '../utils/logger';

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

function verify(token: string) {
  return jwt.verify(token, config.jwtSecret) as { id: string; email: string; role: string };
}

export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({ error: 'Access token is required' });
  }

  try {
    const decoded = verify(token);
    if (!decoded?.id) {
      return res.status(401).json({ error: 'Malformed access token' });
    }
    req.user = { id: decoded.id, email: decoded.email, role: decoded.role || 'STUDENT' };
    next();
  } catch (err: any) {
    // 401 (not 403) for an expired/invalid credential so clients know to re-authenticate.
    const expired = err?.name === 'TokenExpiredError';
    return res.status(401).json({
      error: expired ? 'Access token has expired' : 'Invalid access token',
      code: expired ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID',
    });
  }
};

export const optionalAuthenticateToken = (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
  const token = extractToken(req);
  if (!token) return next();

  try {
    const decoded = verify(token);
    if (decoded?.id) {
      req.user = { id: decoded.id, email: decoded.email, role: decoded.role || 'STUDENT' };
    }
  } catch {
    // Anonymous access is allowed on these routes; ignore a bad token.
  }
  next();
};

/**
 * Gate for catalogue mutation, verification overrides and automation control.
 * A user is an admin if their JWT role is ADMIN or their email is in ADMIN_EMAILS.
 * Must be mounted after authenticateToken.
 */
export const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const email = (req.user.email || '').toLowerCase();
  const isAdmin = req.user.role === 'ADMIN' || config.adminEmails.includes(email);

  if (!isAdmin) {
    logger.warn('Blocked non-admin access to privileged route', {
      userId: req.user.id,
      path: req.originalUrl,
      method: req.method,
    });
    return res.status(403).json({ error: 'Administrator privileges are required for this operation' });
  }

  next();
};
