import { Response, NextFunction } from 'express';
import { ProfileService } from '../services/profileService';
import { AuthenticatedRequest } from '../middleware/auth';

export class ProfileController {
  static async getProfile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const profile = await ProfileService.getProfile(userId);
      res.status(200).json(profile);
    } catch (err) {
      next(err);
    }
  }

  static async updateProfile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const updated = await ProfileService.updateProfile(userId, req.body);
      res.status(200).json(updated);
    } catch (err) {
      next(err);
    }
  }
}
