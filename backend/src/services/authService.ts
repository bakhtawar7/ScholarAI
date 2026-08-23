import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma';
import { config } from '../config';
import { logger } from '../utils/logger';
import { formatStudentProfile } from '../utils/profileSerializer';
import { isAdminUser } from '../utils/authorization';
import { EmailService } from './emailService';

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 12;

/** How long a reset link stays usable. Short by design — it arrives by email. */
const RESET_TOKEN_TTL_MINUTES = Number(process.env.PASSWORD_RESET_TTL_MINUTES) || 60;

/**
 * Cap on live reset links per account per window. Prevents using "forgot password" as a
 * mail-bombing primitive against a known address, without ever telling the requester that
 * a cap was hit (that would leak account existence).
 */
const RESET_MAX_ACTIVE = 3;
const RESET_THROTTLE_WINDOW_MS = 15 * 60_000;

export class AuthService {
  /**
   * Emails are stored lowercased and trimmed.
   *
   * The unique index on `email` is byte-comparison based, so without normalisation
   * "Student@example.com" and "student@example.com" become two distinct accounts
   * and login silently fails for whichever casing the user does not reproduce.
   */
  private static normaliseEmail(email: string) {
    return String(email || '')
      .trim()
      .toLowerCase();
  }

  private static signToken(user: { id: string; email: string; role: string }) {
    return jwt.sign({ id: user.id, email: user.email, role: user.role }, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn,
    } as jwt.SignOptions);
  }

  static async register(email: string, password: string, fullName?: string) {
    const normalisedEmail = this.normaliseEmail(email);

    const existing = await prisma.user.findUnique({ where: { email: normalisedEmail } });
    if (existing) {
      throw { statusCode: 409, message: 'An account with this email already exists' };
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const trimmedName = fullName?.trim();

    try {
      const user = await prisma.user.create({
        data: {
          email: normalisedEmail,
          passwordHash,
          profile: {
            // Always create the profile so downstream services never have to
            // lazily construct one mid-request.
            create: {
              fullName: trimmedName && trimmedName.length > 0 ? trimmedName : 'Student User',
              countryOfResidence: 'Not Specified',
              nationality: 'Not Specified',
              currentDegreeLevel: 'BACHELORS',
              currentDegreeName: 'Undergraduate Student',
              fieldOfStudy: 'General Studies',
              university: 'Not Specified',
              gpa: 0,
              graduationYear: new Date().getFullYear() + 1,
              targetDegreeLevel: 'MASTERS',
              targetCountries: JSON.stringify([]),
              preferredFields: JSON.stringify([]),
              skills: JSON.stringify([]),
              languageTests: JSON.stringify({}),
            },
          },
        },
        include: { profile: true },
      });

      logger.info('User registered', { userId: user.id });

      /**
       * Welcome email — deliberately fire-and-forget.
       *
       * Registration must succeed even if the mail provider is down, so this is not
       * awaited and EmailService never throws. Failures are logged and reported to Sentry
       * inside the service.
       */
      void EmailService.sendWelcome(user.email, { fullName: user.profile?.fullName }, user.id);

      return {
        // Profile JSON columns must be parsed before leaving the API — the client
        // treats these as real arrays.
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          isAdmin: isAdminUser(user),
          profile: formatStudentProfile(user.profile),
        },
        token: this.signToken(user),
      };
    } catch (err: any) {
      // Concurrent registrations with the same email race past the check above.
      if (err?.code === 'P2002') {
        throw { statusCode: 409, message: 'An account with this email already exists' };
      }
      throw err;
    }
  }

  static async login(email: string, password: string) {
    const normalisedEmail = this.normaliseEmail(email);

    const user = await prisma.user.findUnique({
      where: { email: normalisedEmail },
      include: { profile: true },
    });

    // Compare against a dummy hash when the user is absent so response timing does
    // not reveal whether an account exists.
    const hashToCompare = user?.passwordHash || '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin';
    const isMatch = await bcrypt.compare(password, hashToCompare);

    if (!user || !isMatch) {
      // The address is deliberately not logged: failed-login records accumulate real
      // user identifiers in plaintext logs for no diagnostic gain over a count.
      logger.warn('Failed login attempt', { emailKnown: Boolean(user) });
      throw { statusCode: 401, message: 'Invalid email or password' };
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        isAdmin: isAdminUser(user),
        profile: formatStudentProfile(user.profile),
      },
      token: this.signToken(user),
    };
  }

  static async getUserProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        isVerified: true,
        createdAt: true,
        profile: true,
      },
    });
    if (!user) throw { statusCode: 404, message: 'User not found' };
    // isAdmin is computed here rather than left to the client: admin can also be granted
    // by ADMIN_EMAILS, which `role` alone does not reflect.
    return { ...user, isAdmin: isAdminUser(user), profile: formatStudentProfile(user.profile) };
  }

  /** SHA-256 of the reset token. Only this ever reaches the database. */
  private static hashResetToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Starts a password reset.
   *
   * Resolves identically whether or not the address is registered — the caller must not be
   * able to use this endpoint to enumerate accounts. Everything that varies (user found,
   * throttle hit, mail transport down) is logged server-side instead.
   */
  static async requestPasswordReset(email: string, requestedIp?: string) {
    const normalisedEmail = this.normaliseEmail(email);
    const genericResponse = {
      message: 'If an account exists for that address, a password reset link is on its way.',
    };

    const user = await prisma.user.findUnique({
      where: { email: normalisedEmail },
      select: { id: true, email: true, profile: { select: { fullName: true } } },
    });

    if (!user) {
      logger.info('Password reset requested for unknown address', {
        emailHash: this.hashResetToken(normalisedEmail).slice(0, 12),
      });
      return genericResponse;
    }

    const activeCount = await prisma.passwordResetToken.count({
      where: {
        userId: user.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
        createdAt: { gt: new Date(Date.now() - RESET_THROTTLE_WINDOW_MS) },
      },
    });

    if (activeCount >= RESET_MAX_ACTIVE) {
      logger.warn('Password reset throttled — too many active links', { userId: user.id, activeCount });
      return genericResponse;
    }

    // 32 bytes of CSPRNG output; base64url so it survives a query string unescaped.
    const token = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60_000);

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashResetToken(token),
        expiresAt,
        requestedIp: requestedIp || null,
      },
    });

    // Path must match the frontend route in App.tsx (/auth/reset-password).
    const resetUrl = `${config.frontendUrl.replace(/\/+$/, '')}/auth/reset-password?token=${encodeURIComponent(token)}`;

    /**
     * Awaited, unlike the welcome email: if the mail cannot be handed off there is no
     * other way for the user to complete the flow, so the failure is worth knowing about.
     * The response stays generic either way.
     */
    const result = await EmailService.sendPasswordReset(
      user.email,
      { fullName: user.profile?.fullName, resetUrl, expiresInMinutes: RESET_TOKEN_TTL_MINUTES },
      user.id
    );

    if (!result.sent) {
      logger.error('Password reset link could not be delivered', {
        userId: user.id,
        channel: result.channel,
        detail: result.error,
      });
    } else {
      logger.info('Password reset link sent', { userId: user.id, channel: result.channel });
    }

    return genericResponse;
  }

  /**
   * Completes a password reset.
   *
   * The token is single-use, and success bumps passwordChangedAt so every JWT issued
   * before now is rejected by the auth middleware — a reset that left old sessions alive
   * would not actually recover a compromised account.
   */
  static async resetPassword(token: string, newPassword: string) {
    const tokenHash = this.hashResetToken(String(token || ''));

    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, usedAt: true, expiresAt: true },
    });

    // One message for every failure mode: an attacker learns nothing about which links
    // exist, and a user with a stale link gets the same actionable instruction either way.
    const invalid = {
      statusCode: 400,
      message: 'This password reset link is invalid or has expired. Please request a new one.',
    };

    if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
      if (record?.usedAt) logger.warn('Replayed password reset link', { userId: record.userId });
      throw invalid;
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    const now = new Date();

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash, passwordChangedAt: now },
      }),
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: now },
      }),
      // Any other outstanding link for this account is void now that the password changed.
      prisma.passwordResetToken.updateMany({
        where: { userId: record.userId, usedAt: null },
        data: { usedAt: now },
      }),
    ]);

    logger.info('Password reset completed', { userId: record.userId });

    return {
      message: 'Your password has been reset. Please sign in with your new password.',
    };
  }

  /**
   * Changes the password of a signed-in user.
   *
   * Requires the current password even though the caller is already authenticated: a
   * stolen token should not be enough to take permanent ownership of the account.
   */
  static async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });
    if (!user) throw { statusCode: 404, message: 'User not found' };

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      logger.warn('Password change rejected — current password incorrect', { userId });
      throw { statusCode: 401, message: 'Your current password is incorrect' };
    }

    if (await bcrypt.compare(newPassword, user.passwordHash)) {
      throw { statusCode: 400, message: 'Your new password must be different from your current password' };
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    const now = new Date();

    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { passwordHash, passwordChangedAt: now } }),
      prisma.passwordResetToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: now } }),
    ]);

    logger.info('Password changed', { userId });

    /**
     * A fresh token is returned so the caller is not signed out by its own change —
     * passwordChangedAt has just invalidated the token it authenticated with.
     */
    const refreshed = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true },
    });

    return {
      message: 'Your password has been changed. Other devices have been signed out.',
      token: this.signToken(refreshed!),
    };
  }

  /**
   * Ends every session for an account by moving the revocation point forward.
   * Used by "sign out of all devices"; a plain sign-out only discards the client's copy.
   */
  static async signOutEverywhere(userId: string) {
    await prisma.user.update({
      where: { id: userId },
      data: { passwordChangedAt: new Date() },
    });
    logger.info('All sessions revoked', { userId });
    return { message: 'You have been signed out on all devices.' };
  }

  /** Drops spent and expired reset rows. Called by the automation health workflow. */
  static async purgeExpiredResetTokens(): Promise<number> {
    const { count } = await prisma.passwordResetToken.deleteMany({
      where: {
        OR: [{ expiresAt: { lt: new Date() } }, { usedAt: { not: null } }],
      },
    });
    return count;
  }
}
