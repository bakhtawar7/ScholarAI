import { Router } from 'express';
import { ScholarshipController } from '../controllers/scholarshipController';
import { authenticateToken, optionalAuthenticateToken, requireAdmin } from '../middleware/auth';
import { validateRequest } from '../middleware/validate';
import { aiHeavyRateLimiter, createRateLimiter } from '../middleware/rateLimiter';
import {
  scholarshipQuerySchema,
  scholarshipCreateSchema,
  scholarshipUpdateSchema,
  scholarshipIdParamSchema,
  manualReviewSchema,
  customEligibilitySchema,
  verificationQueueQuerySchema,
} from '../validators/scholarshipValidator';

const router = Router();

// Metadata facets for the search & filter explorer (public, cached server-side).
router.get('/filters', ScholarshipController.getFilters);

/**
 * Verification queue and audit trail expose crawler payloads, source URLs and
 * reviewer identities, so they are administrator-only. Previously these ran under
 * optionalAuthenticateToken, which made them fully anonymous.
 */
router.get(
  '/verification/queue',
  authenticateToken,
  requireAdmin,
  validateRequest(verificationQueueQuerySchema),
  ScholarshipController.getVerificationQueue
);
router.get(
  '/:id/verification',
  authenticateToken,
  requireAdmin,
  validateRequest(scholarshipIdParamSchema),
  ScholarshipController.getVerificationAudit
);

/**
 * Triggering a verification re-audit writes to the database and is comparatively
 * expensive, so it is admin-only and additionally rate limited.
 */
router.post(
  '/:id/verify',
  authenticateToken,
  requireAdmin,
  aiHeavyRateLimiter,
  validateRequest(scholarshipIdParamSchema),
  ScholarshipController.triggerVerification
);
router.post(
  '/:id/manual-review',
  authenticateToken,
  requireAdmin,
  validateRequest(manualReviewSchema),
  ScholarshipController.submitManualReview
);

// AI matching & eligibility evaluation (per-user, requires a session).
router.post(
  '/match/recalculate',
  authenticateToken,
  createRateLimiter({
    bucket: 'match-recalculate',
    windowMs: 60_000,
    maxRequests: 6,
    message: 'Match recalculation is rate limited. Please wait a moment before retrying.',
  }),
  ScholarshipController.recalculateMatches
);
router.get(
  '/:id/eligibility',
  optionalAuthenticateToken,
  validateRequest(scholarshipIdParamSchema),
  ScholarshipController.getEligibility
);
router.post(
  '/:id/eligibility/evaluate',
  optionalAuthenticateToken,
  validateRequest(customEligibilitySchema),
  ScholarshipController.evaluateCustomEligibility
);

// Core querying (public browsing is intentional; auth only enriches results).
router.get('/', optionalAuthenticateToken, validateRequest(scholarshipQuerySchema), ScholarshipController.search);
router.get('/:id', optionalAuthenticateToken, validateRequest(scholarshipIdParamSchema), ScholarshipController.getById);

/**
 * Catalogue mutation is admin-only. Any authenticated student could previously
 * create, edit or delete scholarship records for every user of the platform.
 */
router.post('/', authenticateToken, requireAdmin, validateRequest(scholarshipCreateSchema), ScholarshipController.create);
router.put('/:id', authenticateToken, requireAdmin, validateRequest(scholarshipUpdateSchema), ScholarshipController.update);
router.delete('/:id', authenticateToken, requireAdmin, validateRequest(scholarshipIdParamSchema), ScholarshipController.delete);

export default router;
