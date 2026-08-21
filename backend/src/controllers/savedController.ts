import { Response, NextFunction } from 'express';
import { SavedService } from '../services/savedService';
import { AuthenticatedRequest } from '../middleware/auth';

export class SavedController {
  static async getSaved(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const items = await SavedService.getSaved(req.user!.id);
      res.status(200).json(items);
    } catch (err) {
      next(err);
    }
  }

  static async save(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      // Accepts either POST /saved { scholarshipId } or POST /saved/:scholarshipId.
      const targetId = req.params.scholarshipId || req.body?.scholarshipId;
      if (!targetId || typeof targetId !== 'string') {
        return res.status(400).json({ error: 'scholarshipId is required' });
      }

      const result = await SavedService.saveScholarship(req.user!.id, targetId);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async remove(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { scholarshipId } = req.params;
      await SavedService.removeSavedScholarship(req.user!.id, scholarshipId);
      res.status(200).json({ success: true, message: 'Removed from saved' });
    } catch (err) {
      next(err);
    }
  }
}
