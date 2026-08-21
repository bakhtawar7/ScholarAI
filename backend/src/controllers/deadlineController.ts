import { Response, NextFunction } from 'express';
import { DeadlineService } from '../services/deadlineService';
import { DeadlineAutomationService } from '../services/deadlineAutomationService';
import { AuthenticatedRequest } from '../middleware/auth';

export class DeadlineController {
  static async getDeadlines(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const deadlines = await DeadlineService.getDeadlines(userId);
      res.status(200).json(deadlines);
    } catch (err) {
      next(err);
    }
  }

  static async runAutomation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const forceAll = req.query.force === 'true' || req.body.force === true;
      const result = await DeadlineAutomationService.runDeadlineAutomation({ forceAllMilestones: forceAll });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}
