import { Router } from 'express';
import { ProfileController } from '../controllers/profileController';
import { authenticateToken } from '../middleware/auth';
import { validateRequest } from '../middleware/validate';
import { updateProfileSchema } from '../validators/profileValidator';

const router = Router();

router.use(authenticateToken);

router.get('/', ProfileController.getProfile);
// POST and PUT are both accepted for client compatibility; both are full-or-partial upserts.
router.post('/', validateRequest(updateProfileSchema), ProfileController.updateProfile);
router.put('/', validateRequest(updateProfileSchema), ProfileController.updateProfile);
router.patch('/', validateRequest(updateProfileSchema), ProfileController.updateProfile);

export default router;
