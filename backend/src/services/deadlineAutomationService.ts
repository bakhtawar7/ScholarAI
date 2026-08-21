import { prisma } from '../utils/prisma';
import { parseJsonField } from '../utils/jsonHelper';
import { NotificationService } from './notificationService';

export interface DeadlineAutomationResult {
  timestamp: string;
  checkedScholarshipsCount: number;
  processedUsersCount: number;
  notificationsCreated: number;
  duplicatesSuppressed: number;
  submittedSuppressed: number;
  rejectedSuppressed: number;
  expiredCount: number;
  details: Array<{
    scholarshipId: string;
    scholarshipTitle: string;
    deadline: string;
    daysRemaining: number;
    milestoneTag?: string;
    recipientUserId: string;
    actionTaken: 'NOTIFICATION_SENT' | 'SUPPRESSED_ALREADY_SUBMITTED' | 'SUPPRESSED_REJECTED' | 'SUPPRESSED_DUPLICATE' | 'EXPIRED_NOTIFICATION_SENT' | 'NO_ACTIVE_MILESTONE';
    notes?: string;
  }>;
}

export class DeadlineAutomationService {
  /**
   * Standard reminder threshold points in days, held in descending order for display.
   */
  static readonly REMINDER_MILESTONES = [30, 14, 7, 3, 1];

  /**
   * Resolves the milestone a given "days remaining" belongs to.
   *
   * Returns the *smallest* milestone that is still >= daysRemaining, i.e. the most
   * urgent bucket the student currently sits in. Iterating the descending array and
   * breaking on the first `daysRemaining <= m` would return 30 for a student who is
   * 2 days out, which then collides with the already-sent 30-day notification and
   * silently suppresses every urgent reminder.
   */
  private static resolveMilestone(daysRemaining: number): number | null {
    const ascending = [...this.REMINDER_MILESTONES].sort((a, b) => a - b);
    for (const m of ascending) {
      if (daysRemaining <= m) return m;
    }
    return null; // further out than the widest milestone
  }

  /**
   * Evaluates all upcoming scholarship deadlines and dispatches automated alerts
   * to students who have saved or are preparing applications for those scholarships.
   */
  static async runDeadlineAutomation(options: { forceAllMilestones?: boolean } = {}): Promise<DeadlineAutomationResult> {
    const now = new Date();
    const result: DeadlineAutomationResult = {
      timestamp: now.toISOString(),
      checkedScholarshipsCount: 0,
      processedUsersCount: 0,
      notificationsCreated: 0,
      duplicatesSuppressed: 0,
      submittedSuppressed: 0,
      rejectedSuppressed: 0,
      expiredCount: 0,
      details: [],
    };

    // 1. Find scholarships with a defined deadline that still fall inside the widest
    // reminder window (or closed within the last 7 days). Scanning the entire
    // catalogue with both relations eagerly loaded does not scale.
    const widestWindowDays = Math.max(...this.REMINDER_MILESTONES);
    const windowStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + widestWindowDays * 24 * 60 * 60 * 1000);

    const scholarships = await prisma.scholarship.findMany({
      where: {
        deadline: options.forceAllMilestones
          ? { not: null }
          : { not: null, gte: windowStart, lte: windowEnd },
      },
      include: {
        savedBy: { select: { userId: true } },
        applications: { select: { userId: true, status: true } },
      },
      take: 1000,
    });

    result.checkedScholarshipsCount = scholarships.length;

    for (const scholarship of scholarships) {
      if (!scholarship.deadline) continue;

      const deadlineDate = new Date(scholarship.deadline);
      const diffTime = deadlineDate.getTime() - now.getTime();
      const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      const deadlineFormatted = deadlineDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });

      // Combine users who have saved OR applied for this scholarship
      const userInteractionMap = new Map<string, { userId: string; applicationStatus?: string; isSaved: boolean }>();

      scholarship.savedBy.forEach((s: any) => {
        userInteractionMap.set(s.userId, {
          userId: s.userId,
          isSaved: true,
        });
      });

      scholarship.applications.forEach((a: any) => {
        const existing = userInteractionMap.get(a.userId);
        userInteractionMap.set(a.userId, {
          userId: a.userId,
          applicationStatus: a.status,
          isSaved: existing?.isSaved || false,
        });
      });

      // Process each interested user
      for (const [userId, interaction] of userInteractionMap.entries()) {
        result.processedUsersCount++;
        const { applicationStatus } = interaction;

        // CASE 1: Already Submitted Applications (APPLIED, INTERVIEW, ACCEPTED)
        // Suppress pre-submission deadline warnings since the student has already applied
        if (
          applicationStatus === 'APPLIED' ||
          applicationStatus === 'INTERVIEW' ||
          applicationStatus === 'ACCEPTED'
        ) {
          result.submittedSuppressed++;
          result.details.push({
            scholarshipId: scholarship.id,
            scholarshipTitle: scholarship.title,
            deadline: deadlineDate.toISOString(),
            daysRemaining,
            recipientUserId: userId,
            actionTaken: 'SUPPRESSED_ALREADY_SUBMITTED',
            notes: `Application already in status "${applicationStatus}". Pre-deadline warning suppressed.`,
          });
          continue;
        }

        // CASE 2: Rejected Applications
        // Suppress notifications since application is no longer active
        if (applicationStatus === 'REJECTED') {
          result.rejectedSuppressed++;
          result.details.push({
            scholarshipId: scholarship.id,
            scholarshipTitle: scholarship.title,
            deadline: deadlineDate.toISOString(),
            daysRemaining,
            recipientUserId: userId,
            actionTaken: 'SUPPRESSED_REJECTED',
            notes: 'Application was rejected. Deadline notification suppressed.',
          });
          continue;
        }

        // CASE 3: Expired Deadlines (daysRemaining < 0)
        if (daysRemaining < 0) {
          result.expiredCount++;

          // Only notify for recently-closed deadlines, once per user/scholarship.
          if (daysRemaining >= -7) {
            const expiryTag = `[EXPIRED:${scholarship.id}]`;
            const created = await NotificationService.createIfAbsent({
              userId,
              dedupeKey: `DEADLINE_EXPIRED:${userId}:${scholarship.id}`,
              type: 'DEADLINE',
              title: `Deadline passed: ${scholarship.title}`,
              message: `The application deadline for "${scholarship.title}" closed on ${deadlineFormatted}. ${expiryTag}`,
              link: `/scholarships/${scholarship.id}`,
            });

            if (created) {
              result.notificationsCreated++;
              result.details.push({
                scholarshipId: scholarship.id,
                scholarshipTitle: scholarship.title,
                deadline: deadlineDate.toISOString(),
                daysRemaining,
                recipientUserId: userId,
                actionTaken: 'EXPIRED_NOTIFICATION_SENT',
                notes: `Application deadline closed ${Math.abs(daysRemaining)} days ago.`,
              });
            } else {
              result.duplicatesSuppressed++;
            }
          }
          continue;
        }

        // CASE 4: Active Reminder Milestones (30, 14, 7, 3, 1 days)
        // Pick the most urgent milestone bucket this deadline currently falls into.
        // With forceAllMilestones (manual "run scan now"), deadlines beyond the widest
        // milestone are folded into the 30-day bucket so the operator sees output.
        const widestMilestone = Math.max(...this.REMINDER_MILESTONES);
        const matchedMilestone =
          this.resolveMilestone(daysRemaining) ?? (options.forceAllMilestones ? widestMilestone : null);

        if (!matchedMilestone) {
          result.details.push({
            scholarshipId: scholarship.id,
            scholarshipTitle: scholarship.title,
            deadline: deadlineDate.toISOString(),
            daysRemaining,
            recipientUserId: userId,
            actionTaken: 'NO_ACTIVE_MILESTONE',
            notes: `${daysRemaining} days remaining is outside active reminder points (30, 14, 7, 3, 1).`,
          });
          continue;
        }

        // Deduplication is enforced by a unique index on dedupeKey, so overlapping
        // runs cannot both insert the same milestone alert.
        const milestoneTag = `[MILESTONE:${scholarship.id}:${matchedMilestone}D]`;
        const dedupeKey = `DEADLINE:${userId}:${scholarship.id}:${matchedMilestone}D`;

        // Create Deadline Alert Notification
        const urgencyTitle =
          daysRemaining <= 1
            ? `🚨 FINAL CALL: 1 Day Left for ${scholarship.title}`
            : daysRemaining <= 3
            ? `🔴 CRITICAL: ${daysRemaining} Days Left for ${scholarship.title}`
            : daysRemaining <= 7
            ? `🟠 URGENT: 1 Week Remaining for ${scholarship.title}`
            : `⏰ Deadline Alert: ${daysRemaining} Days Left for ${scholarship.title}`;

        const notificationMsg =
          daysRemaining <= 1
            ? `The submission cutoff for "${scholarship.title}" is TOMORROW (${deadlineFormatted}). Please ensure all checklist documents and forms are submitted. ${milestoneTag}`
            : `The application deadline for "${scholarship.title}" is in ${daysRemaining} days (${deadlineFormatted}). Verify your SOP, transcripts, and recommendation letters are on track. ${milestoneTag}`;

        const created = await NotificationService.createIfAbsent({
          userId,
          dedupeKey,
          type: 'DEADLINE',
          title: urgencyTitle,
          message: notificationMsg,
          link: `/scholarships/${scholarship.id}`,
        });

        if (!created) {
          result.duplicatesSuppressed++;
          result.details.push({
            scholarshipId: scholarship.id,
            scholarshipTitle: scholarship.title,
            deadline: deadlineDate.toISOString(),
            daysRemaining,
            milestoneTag,
            recipientUserId: userId,
            actionTaken: 'SUPPRESSED_DUPLICATE',
            notes: `Notification for ${matchedMilestone}-day milestone already sent.`,
          });
          continue;
        }

        result.notificationsCreated++;
        result.details.push({
          scholarshipId: scholarship.id,
          scholarshipTitle: scholarship.title,
          deadline: deadlineDate.toISOString(),
          daysRemaining,
          milestoneTag,
          recipientUserId: userId,
          actionTaken: 'NOTIFICATION_SENT',
          notes: `Sent ${matchedMilestone}-day urgency notification.`,
        });
      }
    }

    return result;
  }
}
