import { Router } from 'express';
import { RecommendationController } from '../controllers/recommendationController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);
router.get('/', RecommendationController.getRecommendations);

export default router;
