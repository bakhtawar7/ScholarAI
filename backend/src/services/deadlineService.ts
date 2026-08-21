import { prisma } from '../utils/prisma';
import { ScholarshipService } from './scholarshipService';

export class DeadlineService {
  static async getDeadlines(userId: string) {
    const [saved, apps] = await Promise.all([
      prisma.savedScholarship.findMany({
        where: { userId },
        include: { scholarship: true },
      }),
      prisma.application.findMany({
        where: { userId },
        include: { scholarship: true },
      }),
    ]);

    const itemsMap = new Map<string, { scholarship: any; status?: string; isSaved: boolean }>();

    saved.forEach((s: any) => {
      itemsMap.set(s.scholarshipId, {
        scholarship: ScholarshipService.formatScholarship(s.scholarship),
        isSaved: true,
      });
    });

    apps.forEach((a: any) => {
      const existing = itemsMap.get(a.scholarshipId);
      itemsMap.set(a.scholarshipId, {
        scholarship: ScholarshipService.formatScholarship(a.scholarship),
        status: a.status,
        isSaved: existing ? existing.isSaved : false,
      });
    });

    const now = new Date();
    const result = Array.from(itemsMap.values())
      .filter((item) => item.scholarship.deadline !== null)
      .map((item) => {
        const deadlineDate = new Date(item.scholarship.deadline);
        const diffTime = deadlineDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        let urgency: 'CRITICAL' | 'URGENT' | 'UPCOMING' | 'EXPIRED' = 'UPCOMING';
        if (diffDays < 0) urgency = 'EXPIRED';
        else if (diffDays <= 7) urgency = 'CRITICAL';
        else if (diffDays <= 30) urgency = 'URGENT';

        return {
          scholarship: item.scholarship,
          status: item.status || 'SAVED',
          isSaved: item.isSaved,
          daysRemaining: diffDays,
          urgency,
          deadlineFormatted: deadlineDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          }),
        };
      })
      .sort((a, b) => a.daysRemaining - b.daysRemaining);

    return result;
  }
}
