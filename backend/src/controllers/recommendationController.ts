import { Response, NextFunction } from 'express';
import { MatchingService } from '../services/matchingService';
import { AuthenticatedRequest } from '../middleware/auth';

export class RecommendationController {
  static async getRecommendations(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const recommendations = await MatchingService.getRecommendationsForUser(userId);
      res.status(200).json(recommendations);
    } catch (err) {
      next(err);
    }
  }
}
