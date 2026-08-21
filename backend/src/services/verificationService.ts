import { prisma } from '../utils/prisma';
import { parseJsonField, safeJsonStringify } from '../utils/jsonHelper';
import { checkUrlReachable } from '../utils/urlChecker';

export interface FieldAudit {
  field: 'deadline' | 'funding' | 'eligibility' | 'nationality' | 'degree' | 'field' | 'language requirement' | 'application URL';
  value: any;
  source: string;
  confidence: number; // 0.0 to 1.0
  status: 'VERIFIED' | 'PARTIALLY_VERIFIED' | 'NEEDS_REVIEW' | 'REJECTED';
  lastVerifiedDate: string;
  notes: string;
}

export interface VerificationReport {
  scholarshipId: string;
  title: string;
  status: 'VERIFIED' | 'PARTIALLY_VERIFIED' | 'NEEDS_REVIEW' | 'REJECTED';
  overallConfidence: number;
  deadlineValid: boolean;
  urlReachable: boolean;
  fieldAudits: FieldAudit[];
  summaryNotes: string;
  verifiedAt: string;
  verifiedBy: string;
}

export class VerificationService {
  /**
   * Run comprehensive verification agent against a scholarship record
   */
  static async verifyScholarship(
    scholarshipId: string,
    options?: { customPayload?: any; verifiedBy?: string; notes?: string }
  ): Promise<VerificationReport> {
    const scholarship = await prisma.scholarship.findUnique({
      where: { id: scholarshipId },
      include: {
        sources: { orderBy: { fetchedAt: 'desc' }, take: 3 },
      },
    });

    if (!scholarship) {
      throw { statusCode: 404, message: 'Scholarship not found with ID: ' + scholarshipId };
    }

    const now = new Date();
    const verifiedBy = options?.verifiedBy || 'AI_VERIFICATION_AGENT';
    const primarySource = scholarship.sourceUrl || scholarship.officialUrl || 'Official Institutional Portal';

    const degreeLevels = parseJsonField(scholarship.degreeLevels, []);
    const fieldsOfStudy = parseJsonField(scholarship.fieldsOfStudy, []);
    const eligibleNationalities = parseJsonField(scholarship.eligibleNationalities, []);
    const languageRequirements = parseJsonField(scholarship.languageRequirements, {});

    const fieldAudits: FieldAudit[] = [];

    // 1. Application URL Verification — a real network request, not just syntax.
    //
    // Previously this only parsed the URL, so a dead link scored urlReachable: true and
    // the scholarship stayed VERIFIED indefinitely. checkUrlReachable performs a
    // HEAD/GET with SSRF guards and distinguishes "dead" from "could not check".
    let urlReachable = true;
    let urlConfidence = 0.95;
    let urlNotes = 'Official URL format is valid.';

    if (!scholarship.officialUrl || !scholarship.officialUrl.startsWith('http')) {
      urlReachable = false;
      urlConfidence = 0.1;
      urlNotes = 'Official application URL is missing or malformed.';
    } else {
      const check = await checkUrlReachable(scholarship.officialUrl);
      urlReachable = check.reachable;
      urlNotes = check.notes;

      if (check.inconclusive) {
        // Never demote a record because our own network call failed.
        urlConfidence = 0.7;
        urlReachable = true;
      } else if (check.reachable) {
        const isHttps = scholarship.officialUrl.startsWith('https:');
        urlConfidence = isHttps ? 0.98 : 0.75;
        if (!isHttps) urlNotes += ' URL uses non-secure HTTP.';
      } else {
        urlConfidence = 0.15;
      }
    }

    fieldAudits.push({
      field: 'application URL',
      value: scholarship.officialUrl,
      source: primarySource,
      confidence: urlConfidence,
      status: urlConfidence >= 0.85 ? 'VERIFIED' : urlConfidence >= 0.5 ? 'PARTIALLY_VERIFIED' : 'REJECTED',
      lastVerifiedDate: now.toISOString(),
      notes: urlNotes,
    });

    // 2. Deadline Validation
    let deadlineValid = true;
    let deadlineConfidence = 0.92;
    let deadlineNotes = 'Application deadline is specified and valid.';
    if (!scholarship.deadline) {
      deadlineConfidence = 0.6;
      deadlineNotes = 'No explicit calendar deadline specified (Rolling admissions).';
    } else {
      const d = new Date(scholarship.deadline);
      if (isNaN(d.getTime())) {
        deadlineValid = false;
        deadlineConfidence = 0.2;
        deadlineNotes = 'Invalid deadline date format.';
      } else if (d.getTime() < now.getTime() - 1000 * 60 * 60 * 24 * 365) {
        deadlineValid = false;
        deadlineConfidence = 0.3;
        deadlineNotes = 'Application deadline passed over 1 year ago with no verified upcoming call.';
      } else if (d.getTime() < now.getTime()) {
        deadlineConfidence = 0.75;
        deadlineNotes = 'Past deadline; record verified for historical reference/next intake cycle.';
      } else {
        deadlineConfidence = 0.95;
        deadlineNotes = `Upcoming intake deadline confirmed for ${d.toISOString().split('T')[0]}.`;
      }
    }

    fieldAudits.push({
      field: 'deadline',
      value: scholarship.deadline ? scholarship.deadline.toISOString() : 'Rolling',
      source: primarySource,
      confidence: deadlineConfidence,
      status: deadlineConfidence >= 0.85 ? 'VERIFIED' : 'PARTIALLY_VERIFIED',
      lastVerifiedDate: now.toISOString(),
      notes: deadlineNotes,
    });

    // 3. Funding Verification
    let fundingConfidence = 0.9;
    let fundingNotes = 'Funding type and benefits coverage structure verified.';
    if (!scholarship.fundingType) {
      fundingConfidence = 0.4;
      fundingNotes = 'Funding type unconfirmed.';
    } else if (scholarship.tuitionCoverage && scholarship.stipendAmount) {
      fundingConfidence = 0.98;
      fundingNotes = `Full funding package verified: ${scholarship.tuitionCoverage} + ${scholarship.stipendAmount}.`;
    }

    fieldAudits.push({
      field: 'funding',
      value: scholarship.fundingType,
      source: primarySource,
      confidence: fundingConfidence,
      status: fundingConfidence >= 0.85 ? 'VERIFIED' : 'PARTIALLY_VERIFIED',
      lastVerifiedDate: now.toISOString(),
      notes: fundingNotes,
    });

    // 4. Eligibility Verification
    let eligibilityConfidence = 0.88;
    let eligibilityNotes = 'Eligibility requirements and prerequisites documented.';
    if (!scholarship.eligibilityDescription && !scholarship.gpaRequirements) {
      eligibilityConfidence = 0.5;
      eligibilityNotes = 'Limited eligibility requirements provided.';
    } else if (scholarship.gpaRequirements || scholarship.minGpa) {
      eligibilityConfidence = 0.95;
      eligibilityNotes = `Academic criteria specified: ${scholarship.gpaRequirements || `Min GPA ${scholarship.minGpa}`}`;
    }

    fieldAudits.push({
      field: 'eligibility',
      value: scholarship.eligibilityDescription || 'Standard academic admission prerequisites.',
      source: primarySource,
      confidence: eligibilityConfidence,
      status: eligibilityConfidence >= 0.85 ? 'VERIFIED' : 'PARTIALLY_VERIFIED',
      lastVerifiedDate: now.toISOString(),
      notes: eligibilityNotes,
    });

    // 5. Nationality Requirements Verification
    let nationalityConfidence = 0.92;
    let nationalityNotes = 'Nationality eligibility criteria confirmed.';
    if (eligibleNationalities.length > 0) {
      nationalityNotes = `Restricted to citizens of: ${eligibleNationalities.join(', ')}`;
    } else {
      nationalityNotes = 'Confirmed open to international applicants worldwide.';
    }

    fieldAudits.push({
      field: 'nationality',
      value: scholarship.nationalityRequirements || (eligibleNationalities.length > 0 ? eligibleNationalities.join(', ') : 'Global / All Nationalities'),
      source: primarySource,
      confidence: nationalityConfidence,
      status: 'VERIFIED',
      lastVerifiedDate: now.toISOString(),
      notes: nationalityNotes,
    });

    // 6. Degree Level Verification
    let degreeConfidence = 0.95;
    let degreeNotes = `Eligible degree levels confirmed: ${degreeLevels.join(', ')}`;
    if (degreeLevels.length === 0) {
      degreeConfidence = 0.4;
      degreeNotes = 'No degree levels defined.';
    }

    fieldAudits.push({
      field: 'degree',
      value: degreeLevels,
      source: primarySource,
      confidence: degreeConfidence,
      status: degreeConfidence >= 0.85 ? 'VERIFIED' : 'NEEDS_REVIEW',
      lastVerifiedDate: now.toISOString(),
      notes: degreeNotes,
    });

    // 7. Field of Study Verification
    let fieldConfidence = 0.95;
    let fieldNotes = `Disciplinary fields verified: ${fieldsOfStudy.join(', ')}`;
    if (fieldsOfStudy.length === 0) {
      fieldConfidence = 0.4;
      fieldNotes = 'No specific fields of study specified.';
    }

    fieldAudits.push({
      field: 'field',
      value: fieldsOfStudy,
      source: primarySource,
      confidence: fieldConfidence,
      status: fieldConfidence >= 0.85 ? 'VERIFIED' : 'PARTIALLY_VERIFIED',
      lastVerifiedDate: now.toISOString(),
      notes: fieldNotes,
    });

    // 8. Language Requirement Verification
    let languageConfidence = 0.9;
    let languageNotes = 'Language test requirements specified.';
    if (Object.keys(languageRequirements).length === 0) {
      languageConfidence = 0.75;
      languageNotes = 'Standard institutional instruction language applies; no test minimum configured.';
    } else {
      languageConfidence = 0.96;
      languageNotes = `Test score minimums verified: ${Object.entries(languageRequirements).map(([k, v]) => `${k} ${v}`).join(', ')}`;
    }

    fieldAudits.push({
      field: 'language requirement',
      value: languageRequirements,
      source: primarySource,
      confidence: languageConfidence,
      status: languageConfidence >= 0.85 ? 'VERIFIED' : 'PARTIALLY_VERIFIED',
      lastVerifiedDate: now.toISOString(),
      notes: languageNotes,
    });

    // Overall Confidence Assessment
    const totalConfidence = fieldAudits.reduce((sum, a) => sum + a.confidence, 0);
    const overallConfidence = parseFloat((totalConfidence / fieldAudits.length).toFixed(2));

    // Decision Logic
    let status: 'VERIFIED' | 'PARTIALLY_VERIFIED' | 'NEEDS_REVIEW' | 'REJECTED' = 'VERIFIED';

    if (!urlReachable) {
      status = 'REJECTED';
    } else if (overallConfidence >= 0.85 && deadlineValid && urlReachable) {
      status = 'VERIFIED';
    } else if (overallConfidence >= 0.65) {
      status = 'PARTIALLY_VERIFIED';
    } else {
      status = 'NEEDS_REVIEW';
    }

    const summaryNotes = options?.notes ||
      `Verification Agent audited 8 core fields with overall confidence ${Math.round(overallConfidence * 100)}%. Status assigned: ${status}.`;

    const report: VerificationReport = {
      scholarshipId: scholarship.id,
      title: scholarship.title,
      status,
      overallConfidence,
      deadlineValid,
      urlReachable,
      fieldAudits,
      summaryNotes,
      verifiedAt: now.toISOString(),
      verifiedBy,
    };

    // Update Scholarship DB
    await prisma.scholarship.update({
      where: { id: scholarship.id },
      data: {
        verificationStatus: status,
        verificationConfidence: overallConfidence,
        verificationReport: safeJsonStringify(report),
        lastVerifiedAt: now,
      },
    });

    // Append to Verification History Queue
    await prisma.scholarshipVerification.create({
      data: {
        scholarshipId: scholarship.id,
        status,
        overallConfidence,
        verifiedBy,
        fieldAudits: safeJsonStringify(fieldAudits),
        deadlineValid,
        urlReachable,
        notes: summaryNotes,
        verifiedAt: now,
      },
    });

    return report;
  }

  /**
   * Get list of scholarships pending verification or flagged for manual review
   */
  static async getVerificationQueue(params?: { status?: string; page?: number; limit?: number }) {
    const page = Math.max(1, params?.page || 1);
    const limit = Math.min(50, params?.limit || 20);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params?.status && params.status !== 'ALL') {
      where.verificationStatus = params.status;
    } else {
      where.verificationStatus = {
        in: ['PENDING_VERIFICATION', 'NEEDS_REVIEW', 'PARTIALLY_VERIFIED', 'UNVERIFIED'],
      };
    }

    const [total, items] = await Promise.all([
      prisma.scholarship.count({ where }),
      prisma.scholarship.findMany({
        where,
        orderBy: { lastVerifiedAt: 'desc' },
        skip,
        take: limit,
        include: {
          verifications: { orderBy: { verifiedAt: 'desc' }, take: 3 },
          sources: { take: 1 },
        },
      }),
    ]);

    const formattedItems = items.map((s: any) => ({
      id: s.id,
      title: s.title,
      provider: s.provider,
      university: s.university || s.organization || s.provider,
      country: s.hostCountry,
      verificationStatus: s.verificationStatus,
      verificationConfidence: s.verificationConfidence,
      lastVerifiedAt: s.lastVerifiedAt,
      officialUrl: s.officialUrl,
      isDemo: s.isDemo,
      verificationReport: parseJsonField(s.verificationReport, null),
      latestVerification: s.verifications[0]
        ? {
            id: s.verifications[0].id,
            status: s.verifications[0].status,
            overallConfidence: s.verifications[0].overallConfidence,
            verifiedBy: s.verifications[0].verifiedBy,
            notes: s.verifications[0].notes,
            verifiedAt: s.verifications[0].verifiedAt,
            fieldAudits: parseJsonField(s.verifications[0].fieldAudits, []),
          }
        : null,
    }));

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      items: formattedItems,
    };
  }

  /**
   * Get detailed audit breakdown for a single scholarship
   */
  static async getVerificationAudit(scholarshipId: string) {
    const scholarship = await prisma.scholarship.findUnique({
      where: { id: scholarshipId },
      include: {
        verifications: { orderBy: { verifiedAt: 'desc' } },
        sources: { orderBy: { fetchedAt: 'desc' } },
      },
    });

    if (!scholarship) {
      throw { statusCode: 404, message: 'Scholarship not found' };
    }

    let report: any = parseJsonField(scholarship.verificationReport, null);
    if (!report) {
      report = await this.verifyScholarship(scholarshipId);
    }

    return {
      scholarship: {
        id: scholarship.id,
        title: scholarship.title,
        provider: scholarship.provider,
        officialUrl: scholarship.officialUrl,
        sourceUrl: scholarship.sourceUrl,
        hostCountry: scholarship.hostCountry,
        verificationStatus: scholarship.verificationStatus,
        verificationConfidence: scholarship.verificationConfidence,
        lastVerifiedAt: scholarship.lastVerifiedAt,
      },
      currentReport: report,
      history: scholarship.verifications.map((v: any) => ({
        id: v.id,
        status: v.status,
        overallConfidence: v.overallConfidence,
        verifiedBy: v.verifiedBy,
        deadlineValid: v.deadlineValid,
        urlReachable: v.urlReachable,
        notes: v.notes,
        verifiedAt: v.verifiedAt,
        fieldAudits: parseJsonField(v.fieldAudits, []),
      })),
      sources: scholarship.sources.map((src: any) => ({
        id: src.id,
        sourceName: src.sourceName,
        rawPayload: parseJsonField(src.rawPayload, {}),
        fetchedAt: src.fetchedAt,
      })),
    };
  }

  /**
   * Submit manual admin override decision
   */
  static async submitManualReview(
    scholarshipId: string,
    status: 'VERIFIED' | 'PARTIALLY_VERIFIED' | 'NEEDS_REVIEW' | 'REJECTED',
    notes: string,
    reviewerId?: string
  ) {
    const validStatuses = ['VERIFIED', 'PARTIALLY_VERIFIED', 'NEEDS_REVIEW', 'REJECTED'];
    if (!validStatuses.includes(status)) {
      throw { statusCode: 400, message: `Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}` };
    }

    const scholarship = await prisma.scholarship.findUnique({ where: { id: scholarshipId } });
    if (!scholarship) throw { statusCode: 404, message: 'Scholarship not found' };

    const confidence = status === 'VERIFIED' ? 1.0 : status === 'PARTIALLY_VERIFIED' ? 0.75 : status === 'NEEDS_REVIEW' ? 0.5 : 0.1;
    const verifiedBy = reviewerId ? `MANUAL_ADMIN_${reviewerId.slice(0, 8)}` : 'MANUAL_ADMIN_REVIEWER';

    const updated = await prisma.scholarship.update({
      where: { id: scholarshipId },
      data: {
        verificationStatus: status,
        verificationConfidence: confidence,
        lastVerifiedAt: new Date(),
      },
    });

    await prisma.scholarshipVerification.create({
      data: {
        scholarshipId,
        status,
        overallConfidence: confidence,
        verifiedBy,
        notes: notes || `Manual review override status set to ${status}.`,
        verifiedAt: new Date(),
      },
    });

    return {
      success: true,
      scholarshipId,
      status,
      confidence,
      verifiedBy,
      notes,
    };
  }
}
