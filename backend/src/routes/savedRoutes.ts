import { Router } from 'express';
import { SavedController } from '../controllers/savedController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);
router.get('/', SavedController.getSaved);
router.post('/', SavedController.save);
router.post('/:scholarshipId', SavedController.save);
router.delete('/:scholarshipId', SavedController.remove);

export default router;
