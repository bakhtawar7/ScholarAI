import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';
import { validateRequest } from '../middleware/validate';
import { authRateLimiter, createRateLimiter } from '../middleware/rateLimiter';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from '../validators/authValidator';

const router = Router();

/**
 * Reset requests get their own, tighter bucket, keyed on IP.
 *
 * Sharing the login bucket would let reset attempts exhaust a legitimate user's login
 * budget (and the reverse). The per-account cap in AuthService.requestPasswordReset is the
 * second layer: this one bounds a single source, that one bounds a single target.
 */
const passwordResetRateLimiter = createRateLimiter({
  bucket: 'password-reset',
  windowMs: 15 * 60_000,
  maxRequests: Number(process.env.RATE_LIMIT_RESET_MAX) || 5,
  message: 'Too many password reset requests. Please try again in a few minutes.',
});

// Credential endpoints are IP-rate-limited to slow credential stuffing.
router.post('/register', authRateLimiter, validateRequest(registerSchema), AuthController.register);
router.post('/login', authRateLimiter, validateRequest(loginSchema), AuthController.login);
router.get('/me', authenticateToken, AuthController.me);

// Password recovery — unauthenticated by necessity, so rate limited hard.
router.post(
  '/forgot-password',
  passwordResetRateLimiter,
  validateRequest(forgotPasswordSchema),
  AuthController.forgotPassword
);
router.post(
  '/reset-password',
  passwordResetRateLimiter,
  validateRequest(resetPasswordSchema),
  AuthController.resetPassword
);

// Authenticated password management.
router.post(
  '/change-password',
  authenticateToken,
  authRateLimiter,
  validateRequest(changePasswordSchema),
  AuthController.changePassword
);
router.post('/logout-all', authenticateToken, AuthController.logoutAll);

export default router;
