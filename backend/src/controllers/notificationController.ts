import { Response, NextFunction } from 'express';
import { NotificationService } from '../services/notificationService';
import { AuthenticatedRequest } from '../middleware/auth';

export class NotificationController {
  static async getNotifications(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
      const unreadOnly = req.query.unreadOnly === 'true';
      const notifications = await NotificationService.getNotifications(req.user!.id, { limit, unreadOnly });
      res.status(200).json(notifications);
    } catch (err) {
      next(err);
    }
  }

  static async getUnreadCount(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const count = await NotificationService.getUnreadCount(req.user!.id);
      res.status(200).json({ count });
    } catch (err) {
      next(err);
    }
  }

  static async markRead(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await NotificationService.markAsRead(req.params.id, req.user!.id);
      res.status(200).json({ success: true });
    } catch (err) {
      next(err);
    }
  }

  static async markAllRead(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await NotificationService.markAllAsRead(req.user!.id);
      res.status(200).json({ success: true, updated: result.count });
    } catch (err) {
      next(err);
    }
  }
}
