import { prisma } from '../utils/prisma';

export class SavedService {
  static async getSaved(userId: string) {
    return prisma.savedScholarship.findMany({
      where: { userId },
      include: { scholarship: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async saveScholarship(userId: string, scholarshipId: string) {
    if (!scholarshipId || typeof scholarshipId !== 'string') {
      throw { statusCode: 400, message: 'scholarshipId is required' };
    }

    // Confirm the target exists first; otherwise the insert fails on a foreign key
    // and surfaces to the client as an opaque 500 instead of a 404.
    const scholarship = await prisma.scholarship.findUnique({
      where: { id: scholarshipId },
      select: { id: true },
    });
    if (!scholarship) {
      throw { statusCode: 404, message: 'Scholarship not found' };
    }

    const existing = await prisma.savedScholarship.findUnique({
      where: { userId_scholarshipId: { userId, scholarshipId } },
      include: { scholarship: true },
    });
    if (existing) return existing;

    try {
      return await prisma.savedScholarship.create({
        data: { userId, scholarshipId },
        include: { scholarship: true },
      });
    } catch (err: any) {
      // Two concurrent saves of the same scholarship — treat as success (idempotent).
      if (err?.code === 'P2002') {
        return prisma.savedScholarship.findUnique({
          where: { userId_scholarshipId: { userId, scholarshipId } },
          include: { scholarship: true },
        });
      }
      throw err;
    }
  }

  static async removeSavedScholarship(userId: string, scholarshipId: string) {
    if (!scholarshipId) {
      throw { statusCode: 400, message: 'scholarshipId is required' };
    }

    const result = await prisma.savedScholarship.deleteMany({
      where: { userId, scholarshipId },
    });

    if (result.count === 0) {
      throw { statusCode: 404, message: 'Scholarship is not in your saved list' };
    }
    return result;
  }
}
