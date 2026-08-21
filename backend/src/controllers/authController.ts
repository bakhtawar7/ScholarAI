import { Response, NextFunction } from 'express';
import { AuthService } from '../services/authService';
import { AuthenticatedRequest } from '../middleware/auth';

export class AuthController {
  static async register(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      // Shape is guaranteed by validateRequest(registerSchema).
      const { email, password, fullName } = req.body;
      const result = await AuthService.register(email, password, fullName);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async login(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      const result = await AuthService.login(email, password);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async me(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const user = await AuthService.getUserProfile(req.user!.id);
      res.status(200).json(user);
    } catch (err) {
      next(err);
    }
  }
}
