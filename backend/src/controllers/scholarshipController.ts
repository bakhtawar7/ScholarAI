import { Response, NextFunction } from 'express';
import { ScholarshipService } from '../services/scholarshipService';
import { VerificationService } from '../services/verificationService';
import { MatchingService } from '../services/matchingService';
import { AuthenticatedRequest } from '../middleware/auth';

export class ScholarshipController {
  static async search(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      // Query params are already validated, coerced and bounded by scholarshipQuerySchema.
      const q = req.query as any;
      const userId = req.user?.id;

      const result = await ScholarshipService.searchScholarships({
        q: q.q,
        hostCountry: q.hostCountry || q.country,
        country: q.country || q.hostCountry,
        degreeLevel: q.degreeLevel || q.degree,
        degree: q.degree || q.degreeLevel,
        field: q.field || q.fieldsOfStudy,
        fieldsOfStudy: q.fieldsOfStudy || q.field,
        fundingType: q.fundingType || q.funding,
        funding: q.funding || q.fundingType,
        deadline: q.deadline,
        deadlineBefore: q.deadlineBefore,
        deadlineAfter: q.deadlineAfter,
        nationality: q.nationality,
        language: q.language,
        minGpa: q.minGpa,
        verificationStatus: q.verificationStatus || q.verifiedStatus,
        verifiedStatus: q.verifiedStatus || q.verificationStatus,
        isDemo: q.isDemo,
        sortBy: q.sortBy,
        page: q.page,
        limit: q.limit,
        userId,
      });

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id;
      const userId = req.user?.id;
      const result = await ScholarshipService.getScholarshipById(id, userId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async getEligibility(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const scholarshipId = req.params.id;
      const userId = req.user?.id;
      const forceRefresh = req.query.forceRefresh === 'true' || req.query.refresh === 'true';

      if (userId) {
        const result = await MatchingService.getScholarshipEligibilityForUser(scholarshipId, userId, { forceRefresh });
        res.status(200).json(result);
      } else {
        const scholarship = await ScholarshipService.getScholarshipById(scholarshipId);
        if (!scholarship) return res.status(404).json({ error: 'Scholarship not found' });
        const result = MatchingService.evaluateCompatibility(null, scholarship);
        res.status(200).json(result);
      }
    } catch (err) {
      next(err);
    }
  }

  static async evaluateCustomEligibility(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const scholarshipId = req.params.id;
      // Whitelisted by customEligibilitySchema — never pass the raw body through.
      const customProfile = req.body?.profile ?? null;
      const scholarship = await ScholarshipService.getScholarshipById(scholarshipId);
      if (!scholarship) return res.status(404).json({ error: 'Scholarship not found' });

      const result = MatchingService.evaluateCompatibility(customProfile, scholarship);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async recalculateMatches(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const recommendations = await MatchingService.getRecommendationsForUser(userId);
      res.status(200).json({
        message: 'Matches recalculated successfully',
        count: recommendations.length,
        recommendations,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getFilters(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const filters = await ScholarshipService.getFilterFacets();
      res.status(200).json(filters);
    } catch (err) {
      next(err);
    }
  }

  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      // Body already validated by scholarshipCreateSchema.
      const result = await ScholarshipService.createScholarship(req.body);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id;
      const result = await ScholarshipService.updateScholarship(id, req.body);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async delete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id;
      const result = await ScholarshipService.deleteScholarship(id);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  // Verification & Audit Endpoints
  static async getVerificationQueue(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { status, page, limit } = req.query as unknown as { status?: string; page: number; limit: number };
      const result = await VerificationService.getVerificationQueue({ status, page, limit });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async getVerificationAudit(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id;
      const result = await VerificationService.getVerificationAudit(id);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async triggerVerification(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id;
      // Admin-only route, so req.user is always present here.
      const verifiedBy = `ADMIN_${req.user!.id.slice(0, 8)}`;
      const result = await VerificationService.verifyScholarship(id, { verifiedBy });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async submitManualReview(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id;
      // status is constrained to the four valid values by manualReviewSchema.
      const { status, notes } = req.body;
      const result = await VerificationService.submitManualReview(id, status, notes, req.user!.id);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}
