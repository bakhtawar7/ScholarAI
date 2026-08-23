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

  /**
   * Always 200 with the same body, whether or not the address is registered — a
   * different status or message here would turn this into an account-enumeration oracle.
   */
  static async forgotPassword(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { email } = req.body;
      const result = await AuthService.requestPasswordReset(email, req.ip);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async resetPassword(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { token, password } = req.body;
      const result = await AuthService.resetPassword(token, password);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async changePassword(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { currentPassword, newPassword } = req.body;
      const result = await AuthService.changePassword(req.user!.id, currentPassword, newPassword);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Revokes every session for the account by advancing its revocation point.
   *
   * A plain sign-out is purely client-side — it discards the stored token but the token
   * itself stays valid until it expires. This is the server-side counterpart, for "sign
   * out everywhere" and for a user who thinks a device was compromised.
   */
  static async logoutAll(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await AuthService.signOutEverywhere(req.user!.id);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}
