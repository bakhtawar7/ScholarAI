import { prisma } from '../utils/prisma';
import { parseJsonField, safeJsonStringify } from '../utils/jsonHelper';
import { MatchingService } from './matchingService';

export interface ScholarshipSearchParams {
  q?: string;
  hostCountry?: string;
  country?: string;
  degreeLevel?: string;
  degree?: string;
  field?: string;
  fieldsOfStudy?: string;
  fundingType?: string;
  funding?: string;
  deadline?: string;
  deadlineBefore?: string;
  deadlineAfter?: string;
  nationality?: string;
  language?: string;
  minGpa?: string | number;
  verificationStatus?: string;
  verifiedStatus?: string;
  isDemo?: string | boolean;
  sortBy?: string;
  page?: number;
  limit?: number;
  userId?: string;
}

export class ScholarshipService {
  public static formatScholarship(s: any) {
    if (!s) return null;

    const degreeLevels = parseJsonField(s.degreeLevels, []);
    const fieldsOfStudy = parseJsonField(s.fieldsOfStudy, []);
    const eligibleNationalities = parseJsonField(s.eligibleNationalities, []);
    const languageRequirements = parseJsonField(s.languageRequirements, {});
    const requiredDocuments = parseJsonField(s.requiredDocuments, []);

    const nationalityReqText =
      s.nationalityRequirements ||
      (eligibleNationalities && eligibleNationalities.length > 0
        ? `Eligible for citizens/residents of: ${eligibleNationalities.join(', ')}`
        : 'Open to all international applicants globally.');

    const gpaReqText =
      s.gpaRequirements ||
      (s.minGpa
        ? `Minimum GPA requirement: ${s.minGpa} on a ${s.maxGpaScale || 4.0} grading scale.`
        : 'No rigid minimum GPA threshold; holistic academic profile evaluated.');

    const eligibilityDesc =
      s.eligibilityDescription ||
      `Open to high-achieving candidates meeting the academic credentials, degree prerequisites in ${fieldsOfStudy.join(', ')}, and English/program language proficiencies.`;

    let parsedCriteria: string[] = [];
    let parsedMissing: string[] = [];
    let parsedUncertain: string[] = [];
    let parsedRecommendations: string[] = [];

    if (s.userMatch) {
      const matchCrit = parseJsonField(s.userMatch.matchingCriteria, []);
      const matchReas = parseJsonField(s.userMatch.matchReasons, []);
      parsedCriteria = (Array.isArray(matchCrit) && matchCrit.length > 0) ? matchCrit : (Array.isArray(matchReas) ? matchReas : []);

      const missCrit = parseJsonField(s.userMatch.missingCriteria, []);
      const missReqs = parseJsonField(s.userMatch.missingReqs, []);
      parsedMissing = (Array.isArray(missCrit) && missCrit.length > 0) ? missCrit : (Array.isArray(missReqs) ? missReqs : []);

      const uncCrit = parseJsonField(s.userMatch.uncertainCriteria, []);
      const uncConc = parseJsonField(s.userMatch.concerns, []);
      parsedUncertain = (Array.isArray(uncCrit) && uncCrit.length > 0) ? uncCrit : (Array.isArray(uncConc) ? uncConc : []);

      const recCrit = parseJsonField(s.userMatch.recommendations, []);
      const recNext = parseJsonField(s.userMatch.nextSteps, []);
      parsedRecommendations = (Array.isArray(recCrit) && recCrit.length > 0) ? recCrit : (Array.isArray(recNext) ? recNext : []);
    }

    return {
      id: s.id,
      title: s.title,
      provider: s.provider,
      university: s.university || s.organization || s.provider,
      organization: s.organization || s.provider,
      country: s.hostCountry,
      hostCountry: s.hostCountry,
      degreeLevels,
      fieldsOfStudy,
      fields: fieldsOfStudy,
      fundingType: s.fundingType,
      tuitionCoverage: s.tuitionCoverage || '100% Full Tuition Coverage',
      stipend: s.stipendAmount,
      stipendAmount: s.stipendAmount,
      accommodation: s.accommodationCoverage,
      accommodationCoverage: s.accommodationCoverage,
      accommodationDetails: s.accommodationDetails,
      travelAllowance: s.travelAllowance,
      minGpa: s.minGpa,
      maxGpaScale: s.maxGpaScale || 4.0,
      gpaRequirements: gpaReqText,
      eligibleNationalities,
      nationalityRequirements: nationalityReqText,
      languageRequirements,
      eligibilityDescription: eligibilityDesc,
      requiredDocuments,
      applicationProcess: s.applicationProcess,
      deadline: s.deadline,
      officialUrl: s.officialUrl,
      officialApplicationUrl: s.officialUrl,
      sourceUrl: s.sourceUrl,
      verificationStatus: s.verificationStatus || 'VERIFIED',
      verificationConfidence: s.verificationConfidence !== undefined ? s.verificationConfidence : 1.0,
      verificationReport: parseJsonField(s.verificationReport, null),
      lastVerifiedAt: s.lastVerifiedAt,
      lastVerifiedDate: s.lastVerifiedAt,
      isDemo: s.isDemo !== undefined ? Boolean(s.isDemo) : true,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      verifications: s.verifications || [],
      sources: s.sources || [],
      userMatch: s.userMatch
        ? {
            id: s.userMatch.id,
            matchScore: s.userMatch.matchScore !== undefined ? s.userMatch.matchScore : s.userMatch.matchPercentage,
            matchPercentage: s.userMatch.matchPercentage !== undefined ? s.userMatch.matchPercentage : s.userMatch.matchScore,
            eligibilityStatus: s.userMatch.eligibilityStatus || s.userMatch.eligibility,
            eligibility: s.userMatch.eligibility || s.userMatch.eligibilityStatus,
            matchingCriteria: parsedCriteria,
            missingCriteria: parsedMissing,
            uncertainCriteria: parsedUncertain,
            warnings: parseJsonField(s.userMatch.warnings, [
              'AI estimate for discovery and planning purposes only. Official requirements must be verified with the scholarship provider.',
            ]),
            recommendations: parsedRecommendations,
            breakdown: parseJsonField(s.userMatch.breakdown, null),
            disclaimer:
              s.userMatch.disclaimer ||
              'AI estimate for discovery and planning purposes only. It does NOT constitute guaranteed official eligibility or an admission decision. Official requirements must be verified with the scholarship provider.',
            isCached: s.userMatch.isCached !== undefined ? s.userMatch.isCached : true,
            calculatedAt: s.userMatch.calculatedAt,
            matchReasons: parsedCriteria,
            missingReqs: parsedMissing,
            concerns: parsedUncertain,
            nextSteps: parsedRecommendations,
          }
        : null,
      isSaved: Boolean(s.isSaved),
      applicationStatus: s.applicationStatus || null,
    };
  }

  static async searchScholarships(params: ScholarshipSearchParams) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 12));
    const skip = (page - 1) * limit;

    const where: any = {};
    const andClauses: any[] = [];

    // 1. Text Search (title, provider, university, organization, hostCountry, fieldsOfStudy, eligibilityDescription)
    const searchQuery = (params.q || '').trim();
    if (searchQuery) {
      andClauses.push({
        OR: [
          { title: { contains: searchQuery } },
          { provider: { contains: searchQuery } },
          { university: { contains: searchQuery } },
          { organization: { contains: searchQuery } },
          { hostCountry: { contains: searchQuery } },
          { fieldsOfStudy: { contains: searchQuery } },
          { eligibilityDescription: { contains: searchQuery } },
        ],
      });
    }

    // 2. Country Filter
    const targetCountry = (params.country || params.hostCountry || '').trim();
    if (targetCountry && targetCountry.toLowerCase() !== 'all') {
      andClauses.push({
        hostCountry: { contains: targetCountry },
      });
    }

    // 3. Degree Level Filter (e.g. BACHELORS, MASTERS, PHD, POSTDOC, SHORT_COURSE)
    const targetDegree = (params.degreeLevel || params.degree || '').trim();
    if (targetDegree && targetDegree.toLowerCase() !== 'all') {
      andClauses.push({
        degreeLevels: { contains: targetDegree },
      });
    }

    // 4. Field of Study Filter
    const targetField = (params.field || params.fieldsOfStudy || '').trim();
    if (targetField && targetField.toLowerCase() !== 'all') {
      andClauses.push({
        fieldsOfStudy: { contains: targetField },
      });
    }

    // 5. Funding Type Filter
    const targetFunding = (params.fundingType || params.funding || '').trim();
    if (targetFunding && targetFunding.toLowerCase() !== 'all') {
      andClauses.push({
        fundingType: targetFunding,
      });
    }

    // 6. Minimum GPA Filter (user GPA >= minGpa required OR minGpa is null)
    if (params.minGpa !== undefined && params.minGpa !== '') {
      const gpaVal = typeof params.minGpa === 'number' ? params.minGpa : parseFloat(params.minGpa);
      if (!isNaN(gpaVal)) {
        andClauses.push({
          OR: [
            { minGpa: null },
            { minGpa: { lte: gpaVal } },
          ],
        });
      }
    }

    // 7. Verification Status Filter
    const targetVerified = (params.verificationStatus || params.verifiedStatus || '').trim();
    if (targetVerified && targetVerified.toLowerCase() !== 'all') {
      andClauses.push({
        verificationStatus: targetVerified,
      });
    }

    // 8. Nationality Filter
    const targetNationality = (params.nationality || '').trim();
    if (targetNationality && targetNationality.toLowerCase() !== 'all') {
      andClauses.push({
        OR: [
          { eligibleNationalities: '[]' },
          { eligibleNationalities: { contains: targetNationality } },
          { nationalityRequirements: { contains: targetNationality } },
        ],
      });
    }

    // 9. Language Filter (e.g. IELTS, TOEFL)
    const targetLanguage = (params.language || '').trim();
    if (targetLanguage && targetLanguage.toLowerCase() !== 'all') {
      andClauses.push({
        languageRequirements: { contains: targetLanguage },
      });
    }

    // 10. Demo Filter
    if (params.isDemo !== undefined && params.isDemo !== '') {
      const isDemoBool = params.isDemo === true || params.isDemo === 'true';
      andClauses.push({ isDemo: isDemoBool });
    }

    // 11. Deadline Filter
    const now = new Date();
    const deadlineParam = (params.deadline || '').trim().toLowerCase();

    if (deadlineParam === 'upcoming' || deadlineParam === 'active') {
      andClauses.push({
        OR: [
          { deadline: null },
          { deadline: { gte: now } },
        ],
      });
    } else if (deadlineParam === 'next_30_days') {
      const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      andClauses.push({
        deadline: { gte: now, lte: thirtyDays },
      });
    } else if (deadlineParam === 'next_90_days') {
      const ninetyDays = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
      andClauses.push({
        deadline: { gte: now, lte: ninetyDays },
      });
    } else if (deadlineParam === 'expired') {
      andClauses.push({
        deadline: { lt: now },
      });
    }

    if (params.deadlineBefore) {
      andClauses.push({
        deadline: { lte: new Date(params.deadlineBefore) },
      });
    }
    if (params.deadlineAfter) {
      andClauses.push({
        deadline: { gte: new Date(params.deadlineAfter) },
      });
    }

    if (andClauses.length > 0) {
      where.AND = andClauses;
    }

    // Sorting Configuration
    const sortBy = (params.sortBy || 'newest').trim().toLowerCase();
    let orderBy: any = { createdAt: 'desc' };

    switch (sortBy) {
      case 'deadline':
      case 'deadline_asc':
      case 'earliest_deadline':
        orderBy = { deadline: 'asc' };
        break;
      case 'deadline_desc':
      case 'latest_deadline':
        orderBy = { deadline: 'desc' };
        break;
      case 'title':
      case 'title_asc':
        orderBy = { title: 'asc' };
        break;
      case 'title_desc':
        orderBy = { title: 'desc' };
        break;
      case 'oldest':
      case 'created_asc':
        orderBy = { createdAt: 'asc' };
        break;
      case 'funding':
        orderBy = { fundingType: 'asc' };
        break;
      case 'newest':
      case 'created_desc':
      default:
        orderBy = { createdAt: 'desc' };
        break;
    }

    const isMatchSort = (sortBy === 'match' || sortBy === 'match_desc') && Boolean(params.userId);

    /**
     * Match-score sorting cannot be expressed in SQL here because scores live in a
     * per-profile table that may not yet be populated. Rather than loading the whole
     * catalogue into memory, cap the candidate window: rank the most recent
     * MATCH_SORT_WINDOW records and paginate within that. Beyond the window, results
     * fall back to recency order.
     */
    const MATCH_SORT_WINDOW = 500;

    const [total, rawItems] = await Promise.all([
      prisma.scholarship.count({ where }),
      prisma.scholarship.findMany({
        where,
        orderBy: isMatchSort ? { createdAt: 'desc' } : orderBy,
        skip: isMatchSort ? 0 : skip,
        take: isMatchSort ? MATCH_SORT_WINDOW : limit,
        include: {
          verifications: { take: 1, orderBy: { verifiedAt: 'desc' } },
        },
      }),
    ]);

    // Augment with User Profile Matches, Saved Status, and Application Status if userId provided
    let matchesMap: Record<string, any> = {};
    let savedMap: Record<string, boolean> = {};
    let appsMap: Record<string, string> = {};

    if (params.userId) {
      const [profile, savedList, appList] = await Promise.all([
        prisma.studentProfile.findUnique({ where: { userId: params.userId } }),
        // Scope to the rows actually on this page instead of loading the user's
        // entire saved/application history on every search.
        prisma.savedScholarship.findMany({
          where: { userId: params.userId, scholarshipId: { in: rawItems.map((i: any) => i.id) } },
          select: { scholarshipId: true },
        }),
        prisma.application.findMany({
          where: { userId: params.userId, scholarshipId: { in: rawItems.map((i: any) => i.id) } },
          select: { scholarshipId: true, status: true },
        }),
      ]);

      savedList.forEach((s: any) => {
        savedMap[s.scholarshipId] = true;
      });

      appList.forEach((a: any) => {
        appsMap[a.scholarshipId] = a.status;
      });

      if (profile) {
        const matches = await prisma.scholarshipMatch.findMany({
          where: { profileId: profile.id, scholarshipId: { in: rawItems.map((i: any) => i.id) } },
        });
        matches.forEach((m: any) => {
          matchesMap[m.scholarshipId] = m;
        });

        // Compute any missing matches on the fly (not persisted — the matching
        // workflow and profile save own persistence).
        for (const item of rawItems) {
          if (!matchesMap[item.id]) {
            matchesMap[item.id] = MatchingService.evaluateCompatibility(profile, item);
          }
        }
      }
    }

    let augmentedItems = rawItems.map(
      (item: any) =>
        // Input is always a real row here, so the formatted result is never null.
        this.formatScholarship({
          ...item,
          userMatch: matchesMap[item.id] || null,
          isSaved: Boolean(savedMap[item.id]),
          applicationStatus: appsMap[item.id] || null,
        })!
    );

    // If sorting by user match score
    if (isMatchSort) {
      augmentedItems.sort((a: any, b: any) => {
        const scoreA = a.userMatch?.matchPercentage || 0;
        const scoreB = b.userMatch?.matchPercentage || 0;
        return scoreB - scoreA;
      });
      augmentedItems = augmentedItems.slice(skip, skip + limit);
    }

    // Facets are catalogue-wide and change only on ingestion, so they are cached
    // rather than recomputed from a full table scan on every search request.
    const availableFilters = await this.getFilterFacets();

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      items: augmentedItems,
      availableFilters,
      ...(isMatchSort && total > MATCH_SORT_WINDOW
        ? { notice: `Match sorting ranks the ${MATCH_SORT_WINDOW} most recent matching scholarships.` }
        : {}),
    };
  }

  /**
   * Cached facet counts.
   *
   * Previously this ran a full-table scan on every search request (in addition to
   * the count and page queries). Ingestion calls invalidateFilterFacets().
   */
  private static facetCache: { data: any; expiresAt: number } | null = null;
  private static readonly FACET_TTL_MS = 5 * 60 * 1000;

  static invalidateFilterFacets() {
    this.facetCache = null;
  }

  static async getFilterFacets() {
    if (this.facetCache && Date.now() < this.facetCache.expiresAt) {
      return this.facetCache.data;
    }

    try {
      // hostCountry / fundingType / verificationStatus are scalar columns, so let the
      // database aggregate them. Only the JSON array columns need in-process counting.
      const [countryGroups, fundingGroups, verificationGroups, jsonRows] = await Promise.all([
        prisma.scholarship.groupBy({ by: ['hostCountry'], _count: { _all: true } }),
        prisma.scholarship.groupBy({ by: ['fundingType'], _count: { _all: true } }),
        prisma.scholarship.groupBy({ by: ['verificationStatus'], _count: { _all: true } }),
        prisma.scholarship.findMany({ select: { degreeLevels: true, fieldsOfStudy: true } }),
      ]);

      const degreeCounts: Record<string, number> = {};
      const fieldCounts: Record<string, number> = {};

      for (const s of jsonRows) {
        for (const d of parseJsonField<string[]>(s.degreeLevels, [])) {
          if (typeof d === 'string') degreeCounts[d] = (degreeCounts[d] || 0) + 1;
        }
        for (const f of parseJsonField<string[]>(s.fieldsOfStudy, [])) {
          if (typeof f === 'string') fieldCounts[f] = (fieldCounts[f] || 0) + 1;
        }
      }

      const data = {
        countries: countryGroups
          .filter((g: any) => g.hostCountry)
          .map((g: any) => ({ value: g.hostCountry, count: g._count._all }))
          .sort((a: any, b: any) => b.count - a.count),
        fundingTypes: fundingGroups
          .filter((g: any) => g.fundingType)
          .map((g: any) => ({ value: g.fundingType, count: g._count._all })),
        degreeLevels: Object.entries(degreeCounts).map(([value, count]) => ({ value, count })),
        fieldsOfStudy: Object.entries(fieldCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 20)
          .map(([value, count]) => ({ value, count })),
        verificationStatuses: verificationGroups
          .filter((g: any) => g.verificationStatus)
          .map((g: any) => ({ value: g.verificationStatus, count: g._count._all })),
      };

      this.facetCache = { data, expiresAt: Date.now() + this.FACET_TTL_MS };
      return data;
    } catch {
      return {
        countries: [],
        fundingTypes: [],
        degreeLevels: [],
        fieldsOfStudy: [],
        verificationStatuses: [],
      };
    }
  }

  static async getScholarshipById(id: string, userId?: string) {
    const scholarship = await prisma.scholarship.findUnique({
      where: { id },
      include: {
        sources: true,
        verifications: { orderBy: { verifiedAt: 'desc' } },
      },
    });

    if (!scholarship) {
      throw { statusCode: 404, message: 'Scholarship not found with ID: ' + id };
    }

    let userMatch = null;
    let isSaved = false;
    let applicationStatus = null;

    if (userId) {
      const profile = await prisma.studentProfile.findUnique({ where: { userId } });
      if (profile) {
        userMatch = await prisma.scholarshipMatch.findUnique({
          where: { profileId_scholarshipId: { profileId: profile.id, scholarshipId: id } },
        });

        if (!userMatch) {
          userMatch = MatchingService.evaluateCompatibility(profile, scholarship);
        }
      }

      const saved = await prisma.savedScholarship.findUnique({
        where: { userId_scholarshipId: { userId, scholarshipId: id } },
      });
      isSaved = !!saved;

      const app = await prisma.application.findUnique({
        where: { userId_scholarshipId: { userId, scholarshipId: id } },
      });
      applicationStatus = app ? app.status : null;
    }

    return this.formatScholarship({
      ...scholarship,
      userMatch,
      isSaved,
      applicationStatus,
    })!;
  }

  static async createScholarship(data: any) {
    // Duplicate prevention: the (title, provider) pair is unique in the schema, so
    // check first to return a clean 409 rather than a raw constraint error.
    const duplicate = await prisma.scholarship.findFirst({
      where: {
        OR: [
          { title: data.title, provider: data.provider },
          { officialUrl: data.officialUrl },
        ],
      },
      select: { id: true, title: true },
    });

    if (duplicate) {
      throw {
        statusCode: 409,
        message: `A scholarship with this title/provider or official URL already exists (id: ${duplicate.id}). Update that record instead.`,
      };
    }

    const created = await prisma.scholarship.create({
      data: {
        title: data.title,
        provider: data.provider,
        university: data.university || null,
        organization: data.organization || data.provider,
        hostCountry: data.hostCountry,
        degreeLevels: Array.isArray(data.degreeLevels) ? safeJsonStringify(data.degreeLevels) : data.degreeLevels,
        fieldsOfStudy: Array.isArray(data.fieldsOfStudy) ? safeJsonStringify(data.fieldsOfStudy) : data.fieldsOfStudy,
        fundingType: data.fundingType || 'FULL_FUNDING',
        tuitionCoverage: data.tuitionCoverage || null,
        stipendAmount: data.stipendAmount || null,
        travelAllowance: Boolean(data.travelAllowance),
        accommodationCoverage: Boolean(data.accommodationCoverage),
        accommodationDetails: data.accommodationDetails || null,
        minGpa: data.minGpa !== undefined ? parseFloat(data.minGpa) : null,
        maxGpaScale: data.maxGpaScale !== undefined ? parseFloat(data.maxGpaScale) : 4.0,
        gpaRequirements: data.gpaRequirements || null,
        eligibleNationalities: Array.isArray(data.eligibleNationalities)
          ? safeJsonStringify(data.eligibleNationalities)
          : safeJsonStringify([]),
        nationalityRequirements: data.nationalityRequirements || null,
        languageRequirements: typeof data.languageRequirements === 'object'
          ? safeJsonStringify(data.languageRequirements)
          : safeJsonStringify({}),
        eligibilityDescription: data.eligibilityDescription || null,
        requiredDocuments: Array.isArray(data.requiredDocuments)
          ? safeJsonStringify(data.requiredDocuments)
          : safeJsonStringify([]),
        applicationProcess: data.applicationProcess,
        deadline: data.deadline ? new Date(data.deadline) : null,
        officialUrl: data.officialUrl,
        sourceUrl: data.sourceUrl || null,
        verificationStatus: data.verificationStatus || 'VERIFIED',
        isDemo: data.isDemo !== undefined ? Boolean(data.isDemo) : true,
      },
    });

    if (data.sourceUrl) {
      await prisma.scholarshipSource.create({
        data: {
          scholarshipId: created.id,
          sourceName: 'Direct Registration',
          rawPayload: safeJsonStringify({ initialUrl: data.sourceUrl }),
        },
      });
    }

    await prisma.scholarshipVerification.create({
      data: {
        scholarshipId: created.id,
        status: data.verificationStatus || 'VERIFIED',
        notes: 'Initial verification record created during ingestion.',
      },
    });

    // New record changes the facet counts.
    this.invalidateFilterFacets();

    return this.formatScholarship(created)!;
  }

  static async updateScholarship(id: string, data: any) {
    const existing = await prisma.scholarship.findUnique({ where: { id } });
    if (!existing) throw { statusCode: 404, message: 'Scholarship not found' };

    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.provider !== undefined) updateData.provider = data.provider;
    if (data.university !== undefined) updateData.university = data.university;
    if (data.organization !== undefined) updateData.organization = data.organization;
    if (data.hostCountry !== undefined) updateData.hostCountry = data.hostCountry;
    if (data.degreeLevels !== undefined) {
      updateData.degreeLevels = Array.isArray(data.degreeLevels) ? safeJsonStringify(data.degreeLevels) : data.degreeLevels;
    }
    if (data.fieldsOfStudy !== undefined) {
      updateData.fieldsOfStudy = Array.isArray(data.fieldsOfStudy) ? safeJsonStringify(data.fieldsOfStudy) : data.fieldsOfStudy;
    }
    if (data.fundingType !== undefined) updateData.fundingType = data.fundingType;
    if (data.tuitionCoverage !== undefined) updateData.tuitionCoverage = data.tuitionCoverage;
    if (data.stipendAmount !== undefined) updateData.stipendAmount = data.stipendAmount;
    if (data.travelAllowance !== undefined) updateData.travelAllowance = Boolean(data.travelAllowance);
    if (data.accommodationCoverage !== undefined) updateData.accommodationCoverage = Boolean(data.accommodationCoverage);
    if (data.accommodationDetails !== undefined) updateData.accommodationDetails = data.accommodationDetails;
    if (data.minGpa !== undefined) updateData.minGpa = data.minGpa !== null ? parseFloat(data.minGpa) : null;
    if (data.maxGpaScale !== undefined) updateData.maxGpaScale = parseFloat(data.maxGpaScale);
    if (data.gpaRequirements !== undefined) updateData.gpaRequirements = data.gpaRequirements;
    if (data.eligibleNationalities !== undefined) {
      updateData.eligibleNationalities = Array.isArray(data.eligibleNationalities)
        ? safeJsonStringify(data.eligibleNationalities)
        : data.eligibleNationalities;
    }
    if (data.nationalityRequirements !== undefined) updateData.nationalityRequirements = data.nationalityRequirements;
    if (data.languageRequirements !== undefined) {
      updateData.languageRequirements = typeof data.languageRequirements === 'object'
        ? safeJsonStringify(data.languageRequirements)
        : data.languageRequirements;
    }
    if (data.eligibilityDescription !== undefined) updateData.eligibilityDescription = data.eligibilityDescription;
    if (data.requiredDocuments !== undefined) {
      updateData.requiredDocuments = Array.isArray(data.requiredDocuments)
        ? safeJsonStringify(data.requiredDocuments)
        : data.requiredDocuments;
    }
    if (data.applicationProcess !== undefined) updateData.applicationProcess = data.applicationProcess;
    if (data.deadline !== undefined) updateData.deadline = data.deadline ? new Date(data.deadline) : null;
    if (data.officialUrl !== undefined) updateData.officialUrl = data.officialUrl;
    if (data.sourceUrl !== undefined) updateData.sourceUrl = data.sourceUrl;
    if (data.verificationStatus !== undefined) {
      updateData.verificationStatus = data.verificationStatus;
      updateData.lastVerifiedAt = new Date();
    }
    if (data.isDemo !== undefined) updateData.isDemo = Boolean(data.isDemo);

    const updated = await prisma.scholarship.update({
      where: { id },
      data: updateData,
    });

    this.invalidateFilterFacets();

    return this.formatScholarship(updated)!;
  }

  static async deleteScholarship(id: string) {
    const existing = await prisma.scholarship.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw { statusCode: 404, message: 'Scholarship not found' };

    // Related matches, saves, applications, sources and verifications cascade
    // via onDelete: Cascade in the schema.
    await prisma.scholarship.delete({ where: { id } });
    this.invalidateFilterFacets();

    return { success: true, message: 'Scholarship deleted successfully' };
  }
}
