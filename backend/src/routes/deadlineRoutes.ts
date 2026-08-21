import { Router } from 'express';
import { DeadlineController } from '../controllers/deadlineController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

router.get('/', DeadlineController.getDeadlines);

/**
 * Admin-only: this sweeps every user's saved and tracked scholarships and writes
 * notifications for all of them. Previously any student could trigger a
 * platform-wide notification run.
 */
router.post('/run-automation', requireAdmin, DeadlineController.runAutomation);

export default router;
