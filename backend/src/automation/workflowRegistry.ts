import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { safeJsonStringify, parseJsonField } from '../utils/jsonHelper';
import { MatchingService } from '../services/matchingService';
import { VerificationService } from '../services/verificationService';
import { DeadlineAutomationService } from '../services/deadlineAutomationService';
import { CVAnalysisService } from '../services/cvAnalysisService';
import { NotificationService } from '../services/notificationService';
import { ScholarshipService } from '../services/scholarshipService';
import { deliverMessages, isDeliveryConfigured } from '../services/deliveryService';
import { EmailService } from '../services/emailService';
import { config } from '../config';

/** Anything a handler returns is persisted as the run's metrics blob. */
export type WorkflowMetrics = Record<string, any>;

export interface WorkflowContext {
  /** Free-form input from a manual trigger; empty for scheduled runs. */
  payload: Record<string, any>;
  /** Emit progress that lands in the server log tagged with the workflow key. */
  log: (message: string, meta?: any) => void;
}

export interface WorkflowDefinition {
  key: string;
  name: string;
  description: string;
  /** Scheduler cadence in minutes. 0 disables automatic scheduling (manual/event only). */
  intervalMinutes: number;
  /** Attempts including the first. Retries apply only to thrown errors. */
  maxAttempts: number;
  /** Delay between retry attempts. */
  retryDelayMs: number;
  /** Skip on boot; used for workflows that only make sense on demand. */
  manualOnly?: boolean;
  handler: (ctx: WorkflowContext) => Promise<WorkflowMetrics>;
}

/**
 * Recovers the scholarship id a notification is about.
 *
 * `dedupeKey` is built by the producers as `<KIND>:<userId>:<scholarshipId>[:…]`
 * (see DeadlineAutomationService and the new-match workflow), so the id is already
 * carried on the row and needs no extra column. Returns null for kinds that do not
 * reference a scholarship — application reminders key on the application id instead.
 */
function scholarshipIdFromDedupeKey(dedupeKey: string | null): string | null {
  if (!dedupeKey) return null;
  const [kind, , third] = dedupeKey.split(':');
  if (!third) return null;
  return kind === 'DEADLINE' || kind === 'NEW_MATCH' ? third : null;
}

/** Normalises whatever a discovery source hands us into a Scholarship row shape. */
function normaliseDiscoveryRecord(data: any) {
  const title = String(data.title || '').trim();
  const officialUrl = String(data.officialUrl || data.applicationUrl || data.url || '').trim();
  const sourceUrl = String(data.sourceUrl || officialUrl || '').trim();
  const provider = String(data.provider || 'Institutional Sponsor').trim();

  const minGpaRaw = data.minGpa ?? data.gpaRequirement;
  const parsedMinGpa = minGpaRaw !== undefined && minGpaRaw !== null ? parseFloat(String(minGpaRaw)) : NaN;
  const minGpa = Number.isFinite(parsedMinGpa) ? parsedMinGpa : null;

  let deadline: Date | null = null;
  if (data.deadline) {
    const d = new Date(data.deadline);
    if (!Number.isNaN(d.getTime())) deadline = d;
  }

  return {
    title,
    officialUrl,
    sourceUrl,
    provider,
    university: String(data.university || data.organization || provider).trim(),
    organization: String(data.organization || provider).trim(),
    hostCountry: String(data.country || data.hostCountry || 'International').trim(),
    degreeLevels: Array.isArray(data.degreeLevels) && data.degreeLevels.length > 0 ? data.degreeLevels : ['MASTERS'],
    fieldsOfStudy:
      Array.isArray(data.fieldsOfStudy) && data.fieldsOfStudy.length > 0
        ? data.fieldsOfStudy
        : Array.isArray(data.fields) && data.fields.length > 0
        ? data.fields
        : ['General Studies'],
    fundingType: String(data.fundingType || 'FULL_FUNDING'),
    tuitionCoverage: data.tuitionCoverage ?? null,
    stipendAmount: data.stipend ?? data.stipendAmount ?? null,
    accommodationCoverage: Boolean(data.accommodation ?? data.accommodationCoverage),
    accommodationDetails: data.accommodationDetails ?? null,
    travelAllowance: Boolean(data.travelAllowance),
    minGpa,
    gpaRequirements: data.gpaRequirements || data.gpaRequirement || (minGpa ? `Minimum GPA of ${minGpa} / 4.0` : null),
    eligibleNationalities: Array.isArray(data.eligibleNationalities) ? data.eligibleNationalities : [],
    nationalityRequirements: data.nationalityRequirements ?? null,
    languageRequirements:
      typeof data.languageRequirements === 'object' && data.languageRequirements !== null ? data.languageRequirements : {},
    eligibilityDescription: data.eligibilityDescription || data.eligibility || null,
    requiredDocuments: Array.isArray(data.requiredDocuments) && data.requiredDocuments.length > 0
      ? data.requiredDocuments
      : ['Academic Transcripts', 'Curriculum Vitae', 'Statement of Purpose'],
    applicationProcess:
      data.applicationProcess || 'Submit online application via official portal with certified credentials.',
    deadline,
    verificationStatus: String(data.verificationStatus || 'PENDING_VERIFICATION'),
    isDemo: data.isDemo !== undefined ? Boolean(data.isDemo) : false,
    sourceName: String(data.sourceName || 'Automated Discovery Crawler').trim(),
    raw: data,
  };
}

/**
 * Upserts one discovered record.
 *
 * Duplicate resolution order matters: an exact (title, provider) pair is the
 * strongest signal, then the official URL, then the source URL. Matching on
 * title alone merges unrelated programmes that happen to share a generic name
 * such as "Merit Scholarship", so it is never used on its own.
 */
async function ingestDiscoveredScholarship(record: ReturnType<typeof normaliseDiscoveryRecord>) {
  const existing =
    (await prisma.scholarship.findFirst({
      where: { title: record.title, provider: record.provider },
    })) ||
    (await prisma.scholarship.findFirst({
      where: { OR: [{ officialUrl: record.officialUrl }, { sourceUrl: record.officialUrl }] },
    }));

  const writable = {
    title: record.title,
    provider: record.provider,
    university: record.university,
    organization: record.organization,
    hostCountry: record.hostCountry,
    degreeLevels: safeJsonStringify(record.degreeLevels),
    fieldsOfStudy: safeJsonStringify(record.fieldsOfStudy),
    fundingType: record.fundingType,
    accommodationCoverage: record.accommodationCoverage,
    accommodationDetails: record.accommodationDetails,
    travelAllowance: record.travelAllowance,
    gpaRequirements: record.gpaRequirements,
    eligibleNationalities: safeJsonStringify(record.eligibleNationalities),
    nationalityRequirements: record.nationalityRequirements,
    languageRequirements: safeJsonStringify(record.languageRequirements),
    eligibilityDescription: record.eligibilityDescription,
    requiredDocuments: safeJsonStringify(record.requiredDocuments),
    applicationProcess: record.applicationProcess,
    deadline: record.deadline,
    officialUrl: record.officialUrl,
    sourceUrl: record.sourceUrl,
    verificationStatus: record.verificationStatus,
    lastVerifiedAt: new Date(),
    isDemo: record.isDemo,
  };

  let scholarship;
  let action: 'CREATED' | 'UPDATED';

  if (existing) {
    scholarship = await prisma.scholarship.update({
      where: { id: existing.id },
      data: {
        ...writable,
        // Never overwrite a known value with null on a refresh.
        tuitionCoverage: record.tuitionCoverage ?? existing.tuitionCoverage,
        stipendAmount: record.stipendAmount ?? existing.stipendAmount,
        minGpa: record.minGpa ?? existing.minGpa,
      },
    });
    action = 'UPDATED';
  } else {
    scholarship = await prisma.scholarship.create({
      data: {
        ...writable,
        tuitionCoverage: record.tuitionCoverage,
        stipendAmount: record.stipendAmount,
        minGpa: record.minGpa,
        maxGpaScale: 4.0,
      },
    });
    action = 'CREATED';
  }

  await prisma.scholarshipSource.create({
    data: {
      scholarshipId: scholarship.id,
      sourceName: record.sourceName,
      rawPayload: safeJsonStringify({
        ingestedAt: new Date().toISOString(),
        rawSource: record.sourceUrl,
        extractedPayload: record.raw,
      }),
    },
  });

  await prisma.scholarshipVerification.create({
    data: {
      scholarshipId: scholarship.id,
      status: record.verificationStatus,
      notes:
        action === 'CREATED'
          ? `New discovery from ${record.sourceName}. Queued for verification.`
          : `Record refreshed from ${record.sourceName}.`,
    },
  });

  return { id: scholarship.id, title: scholarship.title, action, verificationStatus: scholarship.verificationStatus };
}

/**
 * Sample discovery feed.
 *
 * Live crawling of DAAD/Erasmus/Fulbright requires per-source parsers and
 * respecting each portal's terms; that is out of scope here. This handler proves
 * the ingestion, dedupe and verification path end to end using a fixed catalogue,
 * and accepts real records via a manual trigger payload (`{ items: [...] }`).
 */
const SAMPLE_DISCOVERY_FEED = [
  {
    title: 'DAAD Helmut-Schmidt Master Scholarships in Public Policy & CS',
    provider: 'German Academic Exchange Service (DAAD)',
    university: 'University of Passau / Willy Brandt School',
    country: 'Germany',
    degreeLevels: ['MASTERS'],
    fieldsOfStudy: ['Computer Science', 'Public Policy', 'Data Governance'],
    fundingType: 'FULL_FUNDING',
    tuitionCoverage: '100% Full Tuition Waiver',
    stipend: '€934 per month',
    travelAllowance: true,
    accommodation: true,
    minGpa: 3.2,
    deadline: '2026-10-31T23:59:59.000Z',
    officialUrl: 'https://www.daad.de/en/helmut-schmidt-program',
    sourceName: 'DAAD International Programmes Catalogue',
    verificationStatus: 'PENDING_VERIFICATION',
  },
  {
    title: 'Erasmus Mundus Joint Master in Artificial Intelligence Systems',
    provider: 'European Commission',
    university: 'Consortium of European Universities',
    country: 'Germany',
    degreeLevels: ['MASTERS'],
    fieldsOfStudy: ['Computer Science', 'Artificial Intelligence'],
    fundingType: 'FULL_FUNDING',
    tuitionCoverage: '100% Tuition Waiver',
    stipend: '€1,400 per month',
    travelAllowance: true,
    accommodation: true,
    minGpa: 3.5,
    deadline: '2026-11-15T23:59:59.000Z',
    officialUrl: 'https://www.eacea.ec.europa.eu/scholarships/emjmd-ai',
    sourceName: 'European Commission Erasmus+ Announcements',
    verificationStatus: 'PENDING_VERIFICATION',
  },
];

export const WORKFLOWS: WorkflowDefinition[] = [
  // ---------------------------------------------------------------------------
  {
    key: 'scholarship-discovery',
    name: 'Scholarship Discovery & Ingestion',
    description:
      'Ingests scholarship records from configured sources, deduplicates against the catalogue, and queues new records for verification.',
    intervalMinutes: 24 * 60,
    maxAttempts: 3,
    retryDelayMs: 2_000,
    async handler(ctx) {
      const supplied = Array.isArray(ctx.payload?.items) ? ctx.payload.items : null;
      const feed = supplied && supplied.length > 0 ? supplied : SAMPLE_DISCOVERY_FEED;

      const metrics = { received: feed.length, created: 0, updated: 0, invalid: 0, failed: 0, items: [] as any[] };

      for (const raw of feed) {
        const record = normaliseDiscoveryRecord(raw);

        if (!record.title || !record.officialUrl) {
          metrics.invalid++;
          metrics.items.push({ error: 'title and officialUrl are required', title: record.title || null });
          continue;
        }

        try {
          const result = await ingestDiscoveredScholarship(record);
          if (result.action === 'CREATED') metrics.created++;
          else metrics.updated++;
          metrics.items.push(result);
        } catch (err: any) {
          // One bad record must not abort the batch.
          metrics.failed++;
          metrics.items.push({ error: err?.message || 'ingest failed', title: record.title });
          ctx.log('Discovery record failed', { title: record.title, message: err?.message });
        }
      }

      // Ingestion changes country/field/funding counts shown in the explorer filters.
      if (metrics.created > 0 || metrics.updated > 0) {
        ScholarshipService.invalidateFilterFacets();
      }

      return metrics;
    },
  },

  // ---------------------------------------------------------------------------
  {
    key: 'scholarship-verification',
    name: 'Scholarship Verification Agent',
    description:
      'Runs the field-level verification audit over records that are pending verification or flagged for review.',
    intervalMinutes: 6 * 60,
    maxAttempts: 2,
    retryDelayMs: 2_000,
    async handler(ctx) {
      const batchSize = Math.min(50, Math.max(1, Number(ctx.payload?.limit) || 10));

      const pending = await prisma.scholarship.findMany({
        where: { verificationStatus: { in: ['PENDING_VERIFICATION', 'NEEDS_REVIEW', 'UNVERIFIED'] } },
        orderBy: { createdAt: 'desc' },
        take: batchSize,
        select: { id: true, title: true },
      });

      const metrics = {
        audited: pending.length,
        verified: 0,
        partiallyVerified: 0,
        needsReview: 0,
        rejected: 0,
        failed: 0,
        items: [] as any[],
      };

      for (const s of pending) {
        try {
          const report = await VerificationService.verifyScholarship(s.id, { verifiedBy: 'AUTOMATION_VERIFICATION_AGENT' });
          if (report.status === 'VERIFIED') metrics.verified++;
          else if (report.status === 'PARTIALLY_VERIFIED') metrics.partiallyVerified++;
          else if (report.status === 'NEEDS_REVIEW') metrics.needsReview++;
          else metrics.rejected++;
          metrics.items.push({ id: s.id, title: s.title, status: report.status, confidence: report.overallConfidence });
        } catch (err: any) {
          metrics.failed++;
          ctx.log('Verification failed for scholarship', { id: s.id, message: err?.message });
        }
      }

      return metrics;
    },
  },

  // ---------------------------------------------------------------------------
  {
    key: 'scholarship-update-monitoring',
    name: 'Scholarship Update Monitoring',
    description:
      'Detects verified records whose deadline has passed and demotes them to EXPIRED so they stop surfacing as active opportunities.',
    intervalMinutes: 12 * 60,
    maxAttempts: 2,
    retryDelayMs: 2_000,
    async handler(ctx) {
      const now = new Date();
      const batchSize = Math.min(500, Math.max(1, Number(ctx.payload?.limit) || 200));

      const candidates = await prisma.scholarship.findMany({
        where: {
          verificationStatus: { in: ['VERIFIED', 'PARTIALLY_VERIFIED'] },
          deadline: { not: null, lt: now },
        },
        take: batchSize,
        select: { id: true, title: true, deadline: true },
      });

      const metrics = { audited: candidates.length, expired: 0, failed: 0, items: [] as any[] };

      // The previous implementation computed this list and then discarded it,
      // so expired records kept their VERIFIED badge indefinitely.
      for (const s of candidates) {
        try {
          await prisma.scholarship.update({
            where: { id: s.id },
            data: { verificationStatus: 'EXPIRED', lastVerifiedAt: now },
          });
          await prisma.scholarshipVerification.create({
            data: {
              scholarshipId: s.id,
              status: 'EXPIRED',
              overallConfidence: 0.3,
              verifiedBy: 'AUTOMATION_UPDATE_MONITOR',
              deadlineValid: false,
              notes: `Deadline ${s.deadline?.toISOString().split('T')[0]} has passed; record marked EXPIRED pending next intake confirmation.`,
            },
          });
          metrics.expired++;
          metrics.items.push({ id: s.id, title: s.title, deadline: s.deadline, action: 'MARKED_EXPIRED' });
        } catch (err: any) {
          metrics.failed++;
          ctx.log('Failed to expire scholarship', { id: s.id, message: err?.message });
        }
      }

      return metrics;
    },
  },

  // ---------------------------------------------------------------------------
  {
    key: 'personalized-matching',
    name: 'Personalised Matching Engine',
    description: 'Recalculates scholarship compatibility for student profiles whose cached matches are stale.',
    intervalMinutes: 12 * 60,
    maxAttempts: 2,
    retryDelayMs: 2_000,
    async handler(ctx) {
      const explicitProfileId = ctx.payload?.profileId ? String(ctx.payload.profileId) : null;

      if (explicitProfileId) {
        const count = await MatchingService.recalculateMatchesForProfile(explicitProfileId);
        return { profilesProcessed: 1, matchesCalculated: count || 0 };
      }

      // Bounded per run so a large user base cannot stall the scheduler.
      const batchSize = Math.min(200, Math.max(1, Number(ctx.payload?.limit) || 50));
      const profiles = await prisma.studentProfile.findMany({
        select: { id: true },
        orderBy: { updatedAt: 'desc' },
        take: batchSize,
      });

      const metrics = { profilesProcessed: 0, matchesCalculated: 0, failed: 0 };

      for (const p of profiles) {
        try {
          const count = await MatchingService.recalculateMatchesForProfile(p.id);
          metrics.profilesProcessed++;
          metrics.matchesCalculated += count || 0;
        } catch (err: any) {
          metrics.failed++;
          ctx.log('Matching failed for profile', { profileId: p.id, message: err?.message });
        }
      }

      return metrics;
    },
  },

  // ---------------------------------------------------------------------------
  {
    key: 'new-match-notification',
    name: 'New High-Match Notifications',
    description: 'Notifies students about newly calculated high-compatibility matches, once per match.',
    intervalMinutes: 6 * 60,
    maxAttempts: 2,
    retryDelayMs: 2_000,
    async handler(ctx) {
      const minMatchScore = Number(ctx.payload?.minMatchScore) || 80;
      const batchSize = Math.min(500, Math.max(1, Number(ctx.payload?.limit) || 100));

      const matches = await prisma.scholarshipMatch.findMany({
        where: {
          matchPercentage: { gte: minMatchScore },
          eligibility: { in: ['ELIGIBLE', 'POTENTIALLY_ELIGIBLE'] },
        },
        include: { profile: { select: { userId: true } }, scholarship: { select: { title: true, hostCountry: true } } },
        orderBy: { calculatedAt: 'desc' },
        take: batchSize,
      });

      const metrics = { evaluated: matches.length, dispatched: 0, suppressed: 0, failed: 0 };

      for (const match of matches) {
        // Deterministic key per (user, scholarship) — the unique index makes this
        // idempotent even if two runs overlap, unlike a message-substring check.
        const dedupeKey = `NEW_MATCH:${match.profile.userId}:${match.scholarshipId}`;
        try {
          const created = await NotificationService.createIfAbsent({
            userId: match.profile.userId,
            dedupeKey,
            type: 'NEW_MATCH',
            title: `High scholarship match: ${Math.round(match.matchPercentage)}% compatibility`,
            message: `You have a strong academic match for "${match.scholarship.title}" (${match.scholarship.hostCountry}).`,
            link: `/scholarships/${match.scholarshipId}`,
          });
          if (created) metrics.dispatched++;
          else metrics.suppressed++;
        } catch (err: any) {
          metrics.failed++;
          ctx.log('Match notification failed', { dedupeKey, message: err?.message });
        }
      }

      return metrics;
    },
  },

  // ---------------------------------------------------------------------------
  {
    key: 'deadline-reminder',
    name: 'Deadline Reminder Engine',
    description: 'Sends milestone deadline reminders (30/14/7/3/1 days) for saved and tracked scholarships.',
    intervalMinutes: 24 * 60,
    maxAttempts: 3,
    retryDelayMs: 2_000,
    async handler(ctx) {
      const result = await DeadlineAutomationService.runDeadlineAutomation({
        forceAllMilestones: ctx.payload?.force === true,
      });
      return {
        checkedScholarships: result.checkedScholarshipsCount,
        processedUsers: result.processedUsersCount,
        notificationsCreated: result.notificationsCreated,
        duplicatesSuppressed: result.duplicatesSuppressed,
        submittedSuppressed: result.submittedSuppressed,
        rejectedSuppressed: result.rejectedSuppressed,
        expired: result.expiredCount,
      };
    },
  },

  // ---------------------------------------------------------------------------
  {
    key: 'application-reminder',
    name: 'Application Progress Reminders',
    description: 'Nudges students with outstanding checklist items on active applications, at most once every 48 hours.',
    intervalMinutes: 24 * 60,
    maxAttempts: 2,
    retryDelayMs: 2_000,
    async handler(ctx) {
      const batchSize = Math.min(500, Math.max(1, Number(ctx.payload?.limit) || 200));

      const applications = await prisma.application.findMany({
        where: { status: { in: ['INTERESTED', 'PREPARING', 'READY_TO_APPLY'] } },
        include: { scholarship: { select: { title: true } }, checklists: { select: { isCompleted: true } } },
        orderBy: { updatedAt: 'desc' },
        take: batchSize,
      });

      const metrics = { audited: applications.length, dispatched: 0, suppressed: 0, skipped: 0, failed: 0 };
      // Bucket the key by day so the reminder can repeat on a later run but never twice in one day.
      const dayStamp = new Date().toISOString().split('T')[0];

      for (const app of applications) {
        const incomplete = app.checklists.filter((c) => !c.isCompleted).length;
        if (incomplete === 0) {
          metrics.skipped++;
          continue;
        }

        const dedupeKey = `APPLICATION_REMINDER:${app.userId}:${app.id}:${dayStamp}`;
        try {
          const created = await NotificationService.createIfAbsent({
            userId: app.userId,
            dedupeKey,
            type: 'APPLICATION_REMINDER',
            title: `Application checklist progress: ${app.scholarship.title}`,
            message: `You have ${incomplete} of ${app.checklists.length} checklist tasks remaining for "${app.scholarship.title}".`,
            link: '/applications',
          });
          if (created) metrics.dispatched++;
          else metrics.suppressed++;
        } catch (err: any) {
          metrics.failed++;
          ctx.log('Application reminder failed', { applicationId: app.id, message: err?.message });
        }
      }

      return metrics;
    },
  },

  // ---------------------------------------------------------------------------
  {
    key: 'cv-processing',
    name: 'CV Processing',
    description:
      'Runs the nine-dimension CV analysis for a supplied user and optionally syncs extracted skills to their profile. Manual/event driven.',
    intervalMinutes: 0,
    maxAttempts: 1,
    retryDelayMs: 0,
    manualOnly: true,
    async handler(ctx) {
      const userId = ctx.payload?.userId ? String(ctx.payload.userId) : '';
      const cvText = typeof ctx.payload?.cvText === 'string' ? ctx.payload.cvText.trim() : '';

      if (!userId || cvText.length < 30) {
        throw Object.assign(new Error('userId and cvText (min 30 characters) are required'), { statusCode: 400 });
      }

      // Verify the target exists before spending model tokens on it.
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
      if (!user) {
        throw Object.assign(new Error('Target user not found'), { statusCode: 404 });
      }

      const result = await CVAnalysisService.analyzeCV(userId, cvText.slice(0, 40_000));

      let skillsSynced = 0;
      if (ctx.payload?.autoSyncProfile && result.extractedEntities?.skills?.length > 0) {
        await CVAnalysisService.syncToProfile(userId, result.extractedEntities.skills);
        skillsSynced = result.extractedEntities.skills.length;
      }

      return {
        analysisId: result.id,
        score: result.score,
        skillsExtracted: result.extractedEntities.skills.length,
        skillsSynced,
        missingInformationCount: result.missingInformation.length,
      };
    },
  },

  // ---------------------------------------------------------------------------
  {
    key: 'notification-dispatch',
    name: 'Notification Dispatch',
    description:
      'Claims undispatched notifications for outbound delivery and stamps them so no notification is ever handed out twice.',
    intervalMinutes: 15,
    maxAttempts: 2,
    retryDelayMs: 1_000,
    async handler(ctx) {
      const batchSize = Math.min(200, Math.max(1, Number(ctx.payload?.limit) || 50));

      const pending = await prisma.notification.findMany({
        where: { dispatchedAt: null },
        include: {
          user: { select: { id: true, email: true, profile: { select: { fullName: true } } } },
        },
        orderBy: { createdAt: 'asc' },
        take: batchSize,
      });

      if (pending.length === 0) {
        return { pendingCount: 0, dispatched: 0, items: [] };
      }

      const ids = pending.map((n) => n.id);
      const dispatchedAt = new Date();

      // Claim before sending. Returning every unread notification on each poll would
      // make any downstream channel re-send the same message forever.
      await prisma.notification.updateMany({
        where: { id: { in: ids }, dispatchedAt: null },
        data: { dispatchedAt },
      });

      ctx.log(`Claimed ${ids.length} notification(s) for dispatch`);

      const appUrl = config.frontendUrl.replace(/\/+$/, '');

      /**
       * Two delivery paths.
       *
       * Deadline and new-match notifications have a dedicated branded ScholarAI template
       * (subject line, HTML layout, official-page link), so they go through EmailService.
       * Everything else keeps the existing generic plain-text path. A notification is
       * only ever sent down one of the two, so nothing is double-delivered.
       */
      const templated: Array<{ notification: (typeof pending)[number]; scholarshipId: string }> = [];
      const generic: typeof pending = [];

      for (const n of pending) {
        const scholarshipId =
          n.type === 'DEADLINE' || n.type === 'NEW_MATCH' ? scholarshipIdFromDedupeKey(n.dedupeKey) : null;
        if (scholarshipId && n.user?.email) templated.push({ notification: n, scholarshipId });
        else generic.push(n);
      }

      const failedIds: string[] = [];
      let templatedSent = 0;
      let templatedFailed = 0;

      if (templated.length > 0) {
        // Two batched reads rather than a query per notification.
        const scholarshipIds = [...new Set(templated.map((t) => t.scholarshipId))];
        const userIds = [...new Set(templated.map((t) => t.notification.userId))];

        const [scholarships, matches] = await Promise.all([
          prisma.scholarship.findMany({
            where: { id: { in: scholarshipIds } },
            select: { id: true, title: true, hostCountry: true, deadline: true, officialUrl: true },
          }),
          prisma.scholarshipMatch.findMany({
            where: { scholarshipId: { in: scholarshipIds }, profile: { userId: { in: userIds } } },
            select: { scholarshipId: true, matchPercentage: true, profile: { select: { userId: true } } },
          }),
        ]);

        const scholarshipById = new Map(scholarships.map((s) => [s.id, s]));
        const matchByUserScholarship = new Map(
          matches.map((m) => [`${m.profile.userId}:${m.scholarshipId}`, m.matchPercentage])
        );

        for (const { notification, scholarshipId } of templated) {
          const scholarship = scholarshipById.get(scholarshipId);
          // The scholarship was deleted between notification and dispatch — fall back to
          // the generic message rather than dropping the notification.
          if (!scholarship) {
            generic.push(notification);
            continue;
          }

          const fullName = notification.user.profile?.fullName ?? undefined;
          const to = notification.user.email;

          let result;
          if (notification.type === 'NEW_MATCH') {
            result = await EmailService.sendScholarshipMatch(
              to,
              {
                fullName,
                scholarships: [
                  {
                    title: scholarship.title,
                    hostCountry: scholarship.hostCountry,
                    matchScore: matchByUserScholarship.get(`${notification.userId}:${scholarshipId}`) ?? undefined,
                    deadline: scholarship.deadline,
                    officialUrl: scholarship.officialUrl,
                  },
                ],
                appUrl: `${appUrl}${notification.link || '/recommendations'}`,
              },
              notification.userId
            );
          } else {
            // A closed deadline is not a "days remaining" reminder — send the generic
            // notice for those instead of a template that would read as negative days.
            const deadline = scholarship.deadline;
            const daysRemaining = deadline
              ? Math.ceil((new Date(deadline).getTime() - dispatchedAt.getTime()) / 86_400_000)
              : -1;

            if (daysRemaining < 0) {
              generic.push(notification);
              continue;
            }

            result = await EmailService.sendDeadlineReminder(
              to,
              {
                fullName,
                scholarshipTitle: scholarship.title,
                deadline: deadline!,
                daysRemaining,
                officialUrl: scholarship.officialUrl,
                appUrl: `${appUrl}${notification.link || '/applications'}`,
              },
              notification.userId
            );
          }

          if (result.sent) {
            templatedSent++;
          } else if (result.channel === 'log') {
            // No transport configured: nothing was attempted, so this is not a failure
            // to retry. Matches the generic path's 'log' semantics.
          } else {
            templatedFailed++;
            failedIds.push(notification.id);
          }
        }
      }

      // Generic plain-text path, unchanged. Without a transport configured this logs and
      // reports channel 'log', so the run record never implies delivery that did not happen.
      const messages = generic.map((n) => ({
        to: n.user.email,
        subject: n.title,
        text: [
          n.message,
          '',
          n.link ? `Open in the app: ${appUrl}${n.link}` : `Open the app: ${appUrl}`,
          '',
          '---',
          'ScholarAI — automated notification.',
          'Match scores and eligibility assessments are advisory estimates; verify all requirements with the awarding institution.',
        ].join('\n'),
      }));

      const delivery = messages.length
        ? await deliverMessages(messages)
        : { delivered: 0, failed: 0, channel: 'log' as const, errors: [] as string[] };

      // Re-open anything a configured transport rejected so a later run can retry it,
      // rather than silently losing the notification. Log-only mode never releases —
      // nothing was attempted, and releasing would re-claim the same rows forever.
      if (delivery.failed > 0 && delivery.channel !== 'log' && delivery.delivered === 0) {
        failedIds.push(...generic.map((n) => n.id));
      }

      if (failedIds.length > 0) {
        await prisma.notification.updateMany({
          where: { id: { in: failedIds } },
          data: { dispatchedAt: null },
        });
        ctx.log(`Released ${failedIds.length} failed notification(s) so the next run retries`);
      }

      return {
        pendingCount: pending.length,
        claimed: ids.length,
        deliveryChannel: delivery.channel,
        deliveryConfigured: isDeliveryConfigured(),
        delivered: delivery.delivered + templatedSent,
        failed: delivery.failed + templatedFailed,
        templatedDelivered: templatedSent,
        templatedFailed,
        genericDelivered: delivery.delivered,
        released: failedIds.length,
        dispatchedAt: dispatchedAt.toISOString(),
        errors: delivery.errors,
        recipients: pending.slice(0, 25).map((n) => ({ userId: n.userId, type: n.type, title: n.title })),
      };
    },
  },

  // ---------------------------------------------------------------------------
  {
    key: 'data-retention-purge',
    name: 'Data Retention Purge',
    description:
      'Redacts stored CV document text older than the retention window, keeping derived analysis but discarding the raw personal document.',
    intervalMinutes: 24 * 60,
    maxAttempts: 2,
    retryDelayMs: 2_000,
    async handler(ctx) {
      const retentionDays = Number(ctx.payload?.retentionDays ?? config.cvRetentionDays);

      if (!retentionDays || retentionDays <= 0) {
        ctx.log('CV retention purging is disabled (CV_RETENTION_DAYS=0)');
        return { enabled: false, retentionDays: 0, purged: 0 };
      }

      const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

      // Redact rather than delete: scores, extracted skills and history stay useful,
      // while the raw document — the sensitive part — is discarded. The marker also
      // makes the operation idempotent.
      const stale = await prisma.cVAnalysis.findMany({
        where: { createdAt: { lt: cutoff }, NOT: { cvText: '[redacted: retention policy]' } },
        select: { id: true },
        take: 500,
      });

      if (stale.length === 0) {
        return { enabled: true, retentionDays, purged: 0, cutoff: cutoff.toISOString() };
      }

      await prisma.cVAnalysis.updateMany({
        where: { id: { in: stale.map((r) => r.id) } },
        data: { cvText: '[redacted: retention policy]' },
      });

      ctx.log(`Redacted CV text on ${stale.length} record(s) older than ${retentionDays} days`);

      return { enabled: true, retentionDays, purged: stale.length, cutoff: cutoff.toISOString() };
    },
  },

  // ---------------------------------------------------------------------------
  {
    key: 'automation-health-audit',
    name: 'Automation Health Audit',
    description:
      'Summarises recent workflow failures and stale runs so operational problems surface without an external monitor.',
    intervalMinutes: 60,
    maxAttempts: 1,
    retryDelayMs: 0,
    async handler(ctx) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const recent = await prisma.workflowRun.findMany({
        where: { startedAt: { gte: since } },
        select: { workflowKey: true, status: true, durationMs: true, errorMessage: true },
      });

      const byWorkflow: Record<string, { total: number; success: number; failed: number; avgMs: number }> = {};
      for (const run of recent) {
        const entry = (byWorkflow[run.workflowKey] ||= { total: 0, success: 0, failed: 0, avgMs: 0 });
        entry.total++;
        if (run.status === 'SUCCESS') entry.success++;
        if (run.status === 'FAILED') entry.failed++;
        entry.avgMs += run.durationMs || 0;
      }
      for (const entry of Object.values(byWorkflow)) {
        entry.avgMs = entry.total > 0 ? Math.round(entry.avgMs / entry.total) : 0;
      }

      // A RUNNING row older than an hour means a previous process died mid-run.
      const stuck = await prisma.workflowRun.findMany({
        where: { status: 'RUNNING', startedAt: { lt: new Date(Date.now() - 60 * 60 * 1000) } },
        select: { id: true, workflowKey: true, startedAt: true },
      });

      for (const run of stuck) {
        await prisma.workflowRun.update({
          where: { id: run.id },
          data: {
            status: 'FAILED',
            finishedAt: new Date(),
            errorMessage: 'Run abandoned — process terminated before completion.',
            lockKey: null,
          },
        });
        ctx.log('Reaped abandoned workflow run', { workflowKey: run.workflowKey, startedAt: run.startedAt });
      }

      const failures = recent.filter((r) => r.status === 'FAILED');
      if (failures.length > 0) {
        logger.warn('Automation failures in the last 24h', {
          count: failures.length,
          samples: failures.slice(0, 5).map((f) => ({ workflow: f.workflowKey, error: f.errorMessage })),
        });
      }

      return {
        windowHours: 24,
        totalRuns: recent.length,
        failedRuns: failures.length,
        reapedAbandonedRuns: stuck.length,
        byWorkflow,
      };
    },
  },
];

export const WORKFLOW_MAP: Record<string, WorkflowDefinition> = WORKFLOWS.reduce((acc, w) => {
  acc[w.key] = w;
  return acc;
}, {} as Record<string, WorkflowDefinition>);

export function getWorkflow(key: string): WorkflowDefinition | undefined {
  return WORKFLOW_MAP[key];
}
