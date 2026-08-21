import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma';
import { config } from '../config';
import { logger } from '../utils/logger';
import { formatStudentProfile } from '../utils/profileSerializer';
import { EmailService } from './emailService';

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 12;

export class AuthService {
  /**
   * Emails are stored lowercased and trimmed.
   *
   * The unique index on `email` is byte-comparison based, so without normalisation
   * "Student@example.com" and "student@example.com" become two distinct accounts
   * and login silently fails for whichever casing the user does not reproduce.
   */
  private static normaliseEmail(email: string) {
    return String(email || '').trim().toLowerCase();
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
        user: { id: user.id, email: user.email, role: user.role, profile: formatStudentProfile(user.profile) },
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
      logger.warn('Failed login attempt', { email: normalisedEmail });
      throw { statusCode: 401, message: 'Invalid email or password' };
    }

    return {
      user: { id: user.id, email: user.email, role: user.role, profile: formatStudentProfile(user.profile) },
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
    return { ...user, profile: formatStudentProfile(user.profile) };
  }
}
