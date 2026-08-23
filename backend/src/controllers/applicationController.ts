import { Response, NextFunction } from 'express';
import { ApplicationService } from '../services/applicationService';
import { AuthenticatedRequest } from '../middleware/auth';

export class ApplicationController {
  static async getApplications(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const apps = await ApplicationService.getApplications(userId);
      res.status(200).json(apps);
    } catch (err) {
      next(err);
    }
  }

  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      // Validated by applicationCreateSchema.
      const { scholarshipId, status, notes } = req.body;
      const result = await ApplicationService.createApplication(userId, scholarshipId, status, notes);
      if (!result) {
        return res.status(500).json({ error: 'Could not create the application record' });
      }
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async updateStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const { status, notes } = req.body;
      const updated = await ApplicationService.updateStatus(id, userId, status, notes);
      res.status(200).json(updated);
    } catch (err) {
      next(err);
    }
  }

  static async updateApplication(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const { status, notes, submissionDate } = req.body;
      const updated = await ApplicationService.updateApplication(id, userId, {
        status,
        notes,
        submissionDate: submissionDate ? new Date(submissionDate) : submissionDate === null ? null : undefined,
      });
      res.status(200).json(updated);
    } catch (err) {
      next(err);
    }
  }

  static async deleteApplication(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const result = await ApplicationService.deleteApplication(id, userId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async addChecklist(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const { item, dueDate } = req.body;
      const newItem = await ApplicationService.addChecklistItem(
        id,
        userId,
        item,
        dueDate ? new Date(dueDate) : undefined
      );
      res.status(201).json(newItem);
    } catch (err) {
      next(err);
    }
  }

  static async toggleChecklist(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { checklistId } = req.params;
      const updated = await ApplicationService.toggleChecklistItem(checklistId, userId);
      res.status(200).json(updated);
    } catch (err) {
      next(err);
    }
  }

  static async deleteChecklist(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { checklistId } = req.params;
      const result = await ApplicationService.deleteChecklistItem(checklistId, userId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async populateTemplate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const result = await ApplicationService.populateStandardChecklist(id, userId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}
