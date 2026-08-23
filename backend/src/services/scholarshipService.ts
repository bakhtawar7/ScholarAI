import { prisma } from '../utils/prisma';
import { parseJsonField, safeJsonStringify } from '../utils/jsonHelper';
import {
  EMPTY_JSON_ARRAY,
  insensitiveContains,
  insensitiveEquals,
  jsonArrayHasElement,
  jsonObjectHasKey,
} from '../utils/prismaFilters';
import { MatchingService } from './matchingService';

export interface ScholarshipSearchParams {
  q?: string;
  hostCountry?: string;
  country?: string;
  /**
   * Host-country allowlist. Used by the personalised sections to ask for "any of the
   * student's target countries" in one query rather than one request per country.
   */
  countries?: string[];
  /**
   * Host-country denylist, for the "everywhere else" section. Applied after `countries`,
   * so the two are safe to combine.
   */
  excludeCountries?: string[];
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

/**
 * The shape `formatScholarship` returns — derived from the function rather than restated,
 * so the two cannot drift. Type positions are hoisted, so referencing the class declared
 * below is fine.
 */
export type FormattedScholarship = NonNullable<ReturnType<typeof ScholarshipService.formatScholarship>>;

/** One labelled group on the personalised scholarships view. */
export interface PersonalisedSection {
  key: 'home' | 'target' | 'international';
  title: string;
  subtitle: string;
  /** Host countries this section covers. Empty for the catch-all international section. */
  countries: string[];
  items: FormattedScholarship[];
  total: number;
  /** True when the section is empty and a country-scoped live search could fill it. */
  discoverable: boolean;
}

export interface PersonalisedScholarshipsResult {
  profileComplete: boolean;
  homeCountry: string | null;
  targetCountries: string[];
  sections: PersonalisedSection[];
  /** Actionable gaps in the profile, phrased for the user. */
  notices: string[];
}

export class ScholarshipService {
  public static formatScholarship(s: any) {
    if (!s) return null;

    const degreeLevels = parseJsonField(s.degreeLevels, []);
    const fieldsOfStudy = parseJsonField(s.fieldsOfStudy, []);
    const eligibleNationalities = parseJsonField(s.eligibleNationalities, []);
    const languageRequirements = parseJsonField(s.languageRequirements, {});
    const requiredDocuments = parseJsonField(s.requiredDocuments, []);

    /**
     * Absent values are reported as absent.
     *
     * These three fields used to fall back to invented prose when the database held
     * nothing: a scholarship with no stated nationality rule was described as "Open to all
     * international applicants globally", one with no GPA rule as "No rigid minimum GPA
     * threshold; holistic academic profile evaluated", and a missing eligibility summary
     * was synthesised from the field list. All three are claims about someone else's
     * funding programme that nobody had made.
     *
     * Text derived from data that *is* present (a nationality list, a numeric minGpa) is
     * still composed here — that is formatting, not invention.
     */
    const nationalityReqText =
      s.nationalityRequirements ||
      (eligibleNationalities && eligibleNationalities.length > 0
        ? `Open to citizens or residents of: ${eligibleNationalities.join(', ')}.`
        : null);

    const gpaReqText =
      s.gpaRequirements || (s.minGpa ? `Minimum GPA of ${s.minGpa} on a ${s.maxGpaScale || 4.0} scale.` : null);

    const eligibilityDesc = s.eligibilityDescription || null;

    let parsedCriteria: string[] = [];
    let parsedMissing: string[] = [];
    let parsedUncertain: string[] = [];
    let parsedRecommendations: string[] = [];

    if (s.userMatch) {
      const matchCrit = parseJsonField(s.userMatch.matchingCriteria, []);
      const matchReas = parseJsonField(s.userMatch.matchReasons, []);
      parsedCriteria =
        Array.isArray(matchCrit) && matchCrit.length > 0 ? matchCrit : Array.isArray(matchReas) ? matchReas : [];

      const missCrit = parseJsonField(s.userMatch.missingCriteria, []);
      const missReqs = parseJsonField(s.userMatch.missingReqs, []);
      parsedMissing =
        Array.isArray(missCrit) && missCrit.length > 0 ? missCrit : Array.isArray(missReqs) ? missReqs : [];

      const uncCrit = parseJsonField(s.userMatch.uncertainCriteria, []);
      const uncConc = parseJsonField(s.userMatch.concerns, []);
      parsedUncertain = Array.isArray(uncCrit) && uncCrit.length > 0 ? uncCrit : Array.isArray(uncConc) ? uncConc : [];

      const recCrit = parseJsonField(s.userMatch.recommendations, []);
      const recNext = parseJsonField(s.userMatch.nextSteps, []);
      parsedRecommendations =
        Array.isArray(recCrit) && recCrit.length > 0 ? recCrit : Array.isArray(recNext) ? recNext : [];
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
      // null, not '100% Full Tuition Coverage'. Inventing a favourable financial term for a
      // record that states none is the most consequential kind of fabrication this app
      // could make — a student could choose where to apply based on it.
      tuitionCoverage: s.tuitionCoverage || null,
      stipend: s.stipendAmount || null,
      stipendAmount: s.stipendAmount || null,
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
            matchPercentage:
              s.userMatch.matchPercentage !== undefined ? s.userMatch.matchPercentage : s.userMatch.matchScore,
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
    //
    // Free text stays a loose substring match on purpose: someone typing "Engineering"
    // should still find "Chemical Engineering". The facet filters below are the ones that
    // must be element-exact.
    const searchQuery = (params.q || '').trim();
    if (searchQuery) {
      andClauses.push({
        OR: [
          { title: insensitiveContains(searchQuery) },
          { provider: insensitiveContains(searchQuery) },
          { university: insensitiveContains(searchQuery) },
          { organization: insensitiveContains(searchQuery) },
          { hostCountry: insensitiveContains(searchQuery) },
          { fieldsOfStudy: insensitiveContains(searchQuery) },
          { eligibilityDescription: insensitiveContains(searchQuery) },
        ],
      });
    }

    // 2. Country Filter
    //
    // hostCountry is a scalar column and the dropdown is populated from exact groupBy
    // values, so this is an equality test. A substring test made "Ireland" match "Ireland"
    // and any longer country name containing it.
    const targetCountry = (params.country || params.hostCountry || '').trim();
    if (targetCountry && targetCountry.toLowerCase() !== 'all') {
      andClauses.push({
        hostCountry: insensitiveEquals(targetCountry),
      });
    }

    // 2b. Host-country allowlist / denylist, used by the personalised sections.
    const includeCountries = (params.countries || []).map((c) => String(c || '').trim()).filter(Boolean);
    if (includeCountries.length > 0) {
      andClauses.push({ OR: includeCountries.map((c) => ({ hostCountry: insensitiveEquals(c) })) });
    }

    const excludeCountries = (params.excludeCountries || []).map((c) => String(c || '').trim()).filter(Boolean);
    if (excludeCountries.length > 0) {
      // NOT + OR rather than notIn, so the comparison stays case-insensitive on PostgreSQL.
      andClauses.push({ NOT: { OR: excludeCountries.map((c) => ({ hostCountry: insensitiveEquals(c) })) } });
    }

    // 3. Degree Level Filter (e.g. BACHELORS, MASTERS, PHD, POSTDOC, SHORT_COURSE)
    const targetDegree = (params.degreeLevel || params.degree || '').trim();
    if (targetDegree && targetDegree.toLowerCase() !== 'all') {
      andClauses.push({
        degreeLevels: jsonArrayHasElement(targetDegree),
      });
    }

    // 4. Field of Study Filter
    //
    // Element-exact: the facet list offers "Engineering" and "Chemical Engineering" as
    // separate options with separate counts, so selecting one must not return the other.
    const targetField = (params.field || params.fieldsOfStudy || '').trim();
    if (targetField && targetField.toLowerCase() !== 'all') {
      andClauses.push({
        fieldsOfStudy: jsonArrayHasElement(targetField),
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
          OR: [{ minGpa: null }, { minGpa: { lte: gpaVal } }],
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
    //
    // This is the sharpest case for element-exact matching: a substring test let a
    // scholarship restricted to ["Nigeria"] match a student filtering "Niger", i.e. the
    // app told an ineligible student they qualified. The prose column stays a substring
    // match because it is free text, not a serialised list.
    const targetNationality = (params.nationality || '').trim();
    if (targetNationality && targetNationality.toLowerCase() !== 'all') {
      andClauses.push({
        OR: [
          // No stated restriction — open to any nationality.
          { eligibleNationalities: EMPTY_JSON_ARRAY },
          { eligibleNationalities: jsonArrayHasElement(targetNationality) },
          { nationalityRequirements: insensitiveContains(targetNationality) },
        ],
      });
    }

    // 9. Language Filter (e.g. IELTS, TOEFL)
    //
    // languageRequirements is a serialised object like {"IELTS":6.5}; matching the quoted
    // key avoids matching a score or an unrelated substring in the payload.
    const targetLanguage = (params.language || '').trim();
    if (targetLanguage && targetLanguage.toLowerCase() !== 'all') {
      andClauses.push({
        languageRequirements: jsonObjectHasKey(targetLanguage),
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
        OR: [{ deadline: null }, { deadline: { gte: now } }],
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
      /**
       * Nulls last, in both directions.
       *
       * SQL sorts NULL first on ASC, so "earliest deadline" led with every record that has
       * no deadline at all — here, 5 of 21 — burying the genuinely soonest one below the
       * fold on a deadline-driven page. A missing deadline is unknown, not early, and it is
       * not "latest" either, so it belongs at the end of both orderings.
       */
      case 'deadline':
      case 'deadline_asc':
      case 'earliest_deadline':
        orderBy = { deadline: { sort: 'asc', nulls: 'last' } };
        break;
      case 'deadline_desc':
      case 'latest_deadline':
        orderBy = { deadline: { sort: 'desc', nulls: 'last' } };
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
    const matchesMap: Record<string, any> = {};
    const savedMap: Record<string, boolean> = {};
    const appsMap: Record<string, string> = {};

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

    let augmentedItems = rawItems.map((item: any) =>
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

  /**
   * The scholarship page's default view, grouped by how the student relates to each country.
   *
   * Ranking alone was not enough. The page already defaulted to `sortBy: 'match'`, so
   * results *were* personalised — but with a small catalogue that just reorders the same
   * rows, which reads as "nothing is personalised". Splitting into labelled sections makes
   * the relationship explicit, and surfaces the gap that ranking hid: when no scholarship
   * is hosted in the student's own country, that is a fact worth showing rather than an
   * absence buried at the bottom of a list.
   *
   * Sections cover disjoint country sets, so no scholarship appears twice: the target
   * section subtracts the home country, and the international section excludes both.
   */
  static async getPersonalisedSections(
    userId: string,
    opts: { perSection?: number } = {}
  ): Promise<PersonalisedScholarshipsResult> {
    const perSection = Math.min(24, Math.max(3, opts.perSection || 6));

    const profile = await prisma.studentProfile.findUnique({ where: { userId } });

    if (!profile) {
      return {
        profileComplete: false,
        homeCountry: null,
        targetCountries: [],
        sections: [],
        notices: ['Complete your profile to see scholarships grouped for your country and study destinations.'],
      };
    }

    /** "Not Specified" is the placeholder written at registration, not a real answer. */
    const meaningful = (v?: string | null) => {
      const s = String(v || '').trim();
      return s && s.toLowerCase() !== 'not specified' && s.toLowerCase() !== 'unknown' ? s : null;
    };

    const homeCountry = meaningful(profile.countryOfResidence);
    const rawTargets = parseJsonField<string[]>(profile.targetCountries, [])
      .map((c) => String(c || '').trim())
      .filter(Boolean);

    // A home country listed as a target belongs to the home section, not both.
    const targetCountries = rawTargets.filter((c) => !homeCountry || c.toLowerCase() !== homeCountry.toLowerCase());

    const notices: string[] = [];
    if (!homeCountry) {
      notices.push('Add your country of residence to your profile to see scholarships hosted in your own country.');
    }
    if (targetCountries.length === 0) {
      notices.push('Add target countries to your profile to see scholarships in the places you want to study.');
    }

    const excludeFromInternational = [...(homeCountry ? [homeCountry] : []), ...targetCountries];

    // Common shape for every section: upcoming deadlines only, ranked by match score.
    const base = { userId, sortBy: 'match', deadline: 'upcoming', limit: perSection, page: 1 } as const;

    /** Narrows a full search result down to what a section needs. */
    const runSection = async (
      params: ScholarshipSearchParams
    ): Promise<{ items: FormattedScholarship[]; total: number }> => {
      const res = await this.searchScholarships(params);
      return { items: res.items as FormattedScholarship[], total: res.total };
    };

    const empty: { items: FormattedScholarship[]; total: number } = { items: [], total: 0 };

    const [home, target, international] = await Promise.all([
      homeCountry ? runSection({ ...base, countries: [homeCountry] }) : Promise.resolve(empty),
      targetCountries.length > 0 ? runSection({ ...base, countries: targetCountries }) : Promise.resolve(empty),
      runSection({ ...base, excludeCountries: excludeFromInternational }),
    ]);

    const sections: PersonalisedSection[] = [];

    if (homeCountry) {
      sections.push({
        key: 'home',
        title: `In ${homeCountry}`,
        subtitle: 'Scholarships hosted in your own country — no relocation required.',
        countries: [homeCountry],
        items: home.items,
        total: home.total,
        // An empty home section is the one worth offering a live search for: the seeded
        // catalogue is entirely study-abroad destinations.
        discoverable: home.total === 0,
      });
    }

    if (targetCountries.length > 0) {
      sections.push({
        key: 'target',
        title: 'In your target countries',
        subtitle: `Where you said you want to study: ${targetCountries.join(', ')}.`,
        countries: targetCountries,
        items: target.items,
        total: target.total,
        discoverable: target.total === 0,
      });
    }

    sections.push({
      key: 'international',
      title: 'Elsewhere in the world',
      subtitle: 'Strong matches outside the countries on your profile.',
      countries: [],
      items: international.items,
      total: international.total,
      discoverable: false,
    });

    return {
      profileComplete: Boolean(homeCountry && targetCountries.length > 0),
      homeCountry,
      targetCountries,
      sections,
      notices,
    };
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
        OR: [{ title: data.title, provider: data.provider }, { officialUrl: data.officialUrl }],
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
        languageRequirements:
          typeof data.languageRequirements === 'object'
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
      updateData.degreeLevels = Array.isArray(data.degreeLevels)
        ? safeJsonStringify(data.degreeLevels)
        : data.degreeLevels;
    }
    if (data.fieldsOfStudy !== undefined) {
      updateData.fieldsOfStudy = Array.isArray(data.fieldsOfStudy)
        ? safeJsonStringify(data.fieldsOfStudy)
        : data.fieldsOfStudy;
    }
    if (data.fundingType !== undefined) updateData.fundingType = data.fundingType;
    if (data.tuitionCoverage !== undefined) updateData.tuitionCoverage = data.tuitionCoverage;
    if (data.stipendAmount !== undefined) updateData.stipendAmount = data.stipendAmount;
    if (data.travelAllowance !== undefined) updateData.travelAllowance = Boolean(data.travelAllowance);
    if (data.accommodationCoverage !== undefined)
      updateData.accommodationCoverage = Boolean(data.accommodationCoverage);
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
      updateData.languageRequirements =
        typeof data.languageRequirements === 'object'
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
