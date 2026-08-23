import { prisma } from '../utils/prisma';
import { parseJsonField } from '../utils/jsonHelper';
import { logger } from '../utils/logger';

export class ApplicationService {
  static readonly STANDARD_CHECKLIST_TEMPLATE = [
    'CV / Resume',
    'Academic Transcript',
    'Statement of Purpose (SOP) / Motivation Letter',
    'Letters of Recommendation (2)',
    'Valid Passport Copy',
    'Language Certificate (IELTS / TOEFL / Duolingo)',
  ];

  static async getApplications(userId: string) {
    return prisma.application.findMany({
      where: { userId },
      include: {
        scholarship: true,
        checklists: { orderBy: { id: 'asc' } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  static async createApplication(userId: string, scholarshipId: string, status?: string, notes?: string) {
    const scholarship = await prisma.scholarship.findUnique({ where: { id: scholarshipId } });
    if (!scholarship) throw { statusCode: 404, message: 'Scholarship not found' };

    const existing = await prisma.application.findUnique({
      where: { userId_scholarshipId: { userId, scholarshipId } },
      include: { checklists: { orderBy: { id: 'asc' } }, scholarship: true },
    });

    if (existing) return existing;

    const reqDocs: string[] = parseJsonField(scholarship.requiredDocuments, []);

    // Combine standard template items with scholarship-specific requirements.
    // A Set keyed on the exact label matches the (applicationId, item) unique
    // constraint, so the seed set can never contain duplicates.
    const combinedItems = new Set<string>();
    combinedItems.add('Confirm eligibility and deadline details');
    this.STANDARD_CHECKLIST_TEMPLATE.forEach((item) => combinedItems.add(item));
    reqDocs.forEach((doc: string) => {
      if (typeof doc === 'string' && doc.trim()) combinedItems.add(`Official ${doc.trim()}`);
    });
    combinedItems.add('Submit Official Application Form');

    try {
      return await prisma.application.create({
        data: {
          userId,
          scholarshipId,
          status: status || 'INTERESTED',
          notes: notes || '',
          submissionDate: status === 'APPLIED' ? new Date() : undefined,
          checklists: {
            create: Array.from(combinedItems).map((item) => ({ item, isCompleted: false })),
          },
        },
        include: {
          scholarship: true,
          checklists: { orderBy: { id: 'asc' } },
        },
      });
    } catch (err: any) {
      // Two concurrent "track this scholarship" clicks — return the winner.
      if (err?.code === 'P2002') {
        return prisma.application.findUnique({
          where: { userId_scholarshipId: { userId, scholarshipId } },
          include: { checklists: { orderBy: { id: 'asc' } }, scholarship: true },
        });
      }
      throw err;
    }
  }

  static async updateStatus(
    applicationId: string,
    userId: string,
    status: string,
    notes?: string,
    submissionDate?: Date
  ) {
    const app = await prisma.application.findFirst({
      where: { id: applicationId, userId },
    });

    if (!app) throw { statusCode: 404, message: 'Application not found' };

    let finalSubmissionDate = app.submissionDate;
    if (submissionDate !== undefined) {
      finalSubmissionDate = submissionDate;
    } else if (status === 'APPLIED' && !app.submissionDate) {
      finalSubmissionDate = new Date();
    }

    const updated = await prisma.application.update({
      where: { id: applicationId },
      data: {
        status,
        notes: notes !== undefined ? notes : app.notes,
        submissionDate: finalSubmissionDate,
      },
      include: { scholarship: true, checklists: true },
    });

    // Notify the applicant only when the status actually changed. Fire-and-forget: a
    // mail failure must not fail the status update itself.
    if (app.status !== updated.status) {
      void ApplicationService.notifyStatusChange(userId, updated);
    }

    return updated;
  }

  /**
   * Sends the application-update email.
   *
   * Kept private-by-convention and never awaited by callers, so email latency and
   * provider outages stay off the request path.
   */
  private static async notifyStatusChange(userId: string, application: any) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, profile: { select: { fullName: true } } },
      });
      if (!user?.email) return;

      const { EmailService } = await import('./emailService');
      await EmailService.sendApplicationUpdate(
        user.email,
        {
          fullName: user.profile?.fullName,
          scholarshipTitle: application.scholarship?.title || 'your scholarship application',
          status: application.status,
          notes: application.notes,
        },
        userId
      );
    } catch (err: any) {
      logger.warn('Application status email could not be sent', { userId, message: err?.message });
    }
  }

  static async updateApplication(
    applicationId: string,
    userId: string,
    data: { status?: string; notes?: string; submissionDate?: Date | null }
  ) {
    const app = await prisma.application.findFirst({
      where: { id: applicationId, userId },
    });

    if (!app) throw { statusCode: 404, message: 'Application not found' };

    return prisma.application.update({
      where: { id: applicationId },
      data: {
        status: data.status !== undefined ? data.status : app.status,
        notes: data.notes !== undefined ? data.notes : app.notes,
        submissionDate: data.submissionDate !== undefined ? data.submissionDate : app.submissionDate,
      },
      include: { scholarship: true, checklists: true },
    });
  }

  static async addChecklistItem(applicationId: string, userId: string, item: string, dueDate?: Date) {
    const app = await prisma.application.findFirst({
      where: { id: applicationId, userId },
      select: { id: true },
    });

    if (!app) throw { statusCode: 404, message: 'Application not found' };

    try {
      return await prisma.applicationChecklist.create({
        data: { applicationId, item, dueDate },
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw { statusCode: 409, message: 'That checklist item already exists for this application' };
      }
      throw err;
    }
  }

  static async toggleChecklistItem(checklistId: string, userId: string) {
    const item = await prisma.applicationChecklist.findUnique({
      where: { id: checklistId },
      include: { application: true },
    });

    if (!item || item.application.userId !== userId) {
      throw { statusCode: 404, message: 'Checklist item not found' };
    }

    return prisma.applicationChecklist.update({
      where: { id: checklistId },
      data: { isCompleted: !item.isCompleted },
    });
  }

  static async deleteChecklistItem(checklistId: string, userId: string) {
    const item = await prisma.applicationChecklist.findUnique({
      where: { id: checklistId },
      include: { application: true },
    });

    if (!item || item.application.userId !== userId) {
      throw { statusCode: 404, message: 'Checklist item not found or unauthorized' };
    }

    await prisma.applicationChecklist.delete({
      where: { id: checklistId },
    });

    return { success: true, message: 'Checklist item deleted.' };
  }

  static async populateStandardChecklist(applicationId: string, userId: string) {
    const app = await prisma.application.findFirst({
      where: { id: applicationId, userId },
      include: { checklists: true },
    });

    if (!app) throw { statusCode: 404, message: 'Application not found' };

    const existingNames = new Set(app.checklists.map((c: any) => c.item.toLowerCase()));
    const toAdd = this.STANDARD_CHECKLIST_TEMPLATE.filter((t) => !existingNames.has(t.toLowerCase()));

    if (toAdd.length > 0) {
      // createMany + skipDuplicates in a single round-trip; the unique index makes
      // repeated clicks a no-op instead of stacking duplicate rows.
      await prisma.applicationChecklist.createMany({
        data: toAdd.map((item) => ({ applicationId, item, isCompleted: false })),
      });
    }

    return this.getApplications(userId);
  }

  static async deleteApplication(applicationId: string, userId: string) {
    const app = await prisma.application.findFirst({
      where: { id: applicationId, userId },
    });

    if (!app) throw { statusCode: 404, message: 'Application not found' };

    await prisma.application.delete({
      where: { id: applicationId },
    });

    return { success: true, message: 'Application deleted successfully' };
  }
}
