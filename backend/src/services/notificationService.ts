import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { captureException } from '../utils/sentry';

export interface CreateNotificationInput {
  userId: string;
  title: string;
  message: string;
  type: string;
  link?: string;
  /**
   * Stable key identifying this exact notification occurrence. Backed by a unique
   * index, so concurrent automation runs cannot both insert the same alert.
   */
  dedupeKey?: string;
}

export class NotificationService {
  static async getNotifications(userId: string, options: { limit?: number; unreadOnly?: boolean } = {}) {
    const limit = Math.min(100, Math.max(1, options.limit || 50));
    return prisma.notification.findMany({
      where: { userId, ...(options.unreadOnly ? { isRead: false } : {}) },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  static async getUnreadCount(userId: string) {
    return prisma.notification.count({ where: { userId, isRead: false } });
  }

  static async markAsRead(id: string, userId: string) {
    // updateMany scopes the write to the owner, so one user cannot mark another's
    // notification as read by guessing an id.
    const result = await prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
    if (result.count === 0) {
      throw { statusCode: 404, message: 'Notification not found' };
    }
    return result;
  }

  static async markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  static async createNotification(
    userId: string,
    title: string,
    message: string,
    type: string,
    link?: string,
    dedupeKey?: string
  ) {
    return prisma.notification.create({
      data: { userId, title, message, type, link, dedupeKey },
    });
  }

  /**
   * Inserts a notification unless one with the same dedupeKey already exists.
   * Returns the created record, or null when suppressed as a duplicate.
   *
   * Relies on the unique constraint rather than a read-then-write check, so it stays
   * correct when two workflow runs overlap.
   */
  static async createIfAbsent(input: CreateNotificationInput) {
    if (!input.dedupeKey) {
      return prisma.notification.create({
        data: {
          userId: input.userId,
          title: input.title,
          message: input.message,
          type: input.type,
          link: input.link,
        },
      });
    }

    try {
      return await prisma.notification.create({
        data: {
          userId: input.userId,
          title: input.title,
          message: input.message,
          type: input.type,
          link: input.link,
          dedupeKey: input.dedupeKey,
        },
      });
    } catch (err: any) {
      if (err?.code === 'P2002') return null; // already sent
      logger.error('Failed to create notification', { dedupeKey: input.dedupeKey, message: err?.message });
      captureException(err, {
        area: 'database',
        userId: input.userId,
        extra: { stage: 'create-notification', type: input.type, code: err?.code },
      });
      throw err;
    }
  }
}
