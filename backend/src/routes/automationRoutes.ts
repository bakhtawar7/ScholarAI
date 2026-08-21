import { Router } from 'express';
import {
  AutomationController,
  triggerWorkflowSchema,
  runsQuerySchema,
} from '../controllers/automationController';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { validateRequest } from '../middleware/validate';
import { createRateLimiter } from '../middleware/rateLimiter';

const router = Router();

/**
 * Automation control is admin-only: a manual trigger can start a catalogue-wide
 * recalculation or a notification sweep, which is not something a student account
 * should be able to initiate.
 */
router.use(authenticateToken, requireAdmin);

router.get('/workflows', AutomationController.listWorkflows);
router.get('/stats', AutomationController.getStats);
router.get('/runs', validateRequest(runsQuerySchema), AutomationController.listRuns);
router.get('/runs/:id', AutomationController.getRun);

// Manual triggers are the expensive path — keep them tightly limited.
router.post(
  '/workflows/:key/run',
  createRateLimiter({
    bucket: 'automation-trigger',
    windowMs: 60_000,
    maxRequests: 10,
    message: 'Too many manual workflow triggers. Please wait before running another.',
  }),
  validateRequest(triggerWorkflowSchema),
  AutomationController.triggerWorkflow
);

export default router;
