import { Response, NextFunction } from 'express';
import { OrchestratorAgent } from '../agents/orchestratorAgent';
import { AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../utils/prisma';

export class ChatController {
  static async listConversations(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const convs = await prisma.chatConversation.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        // Bounded so a heavy user cannot request an unbounded payload.
        take: 100,
        include: { messages: { take: 1, orderBy: { createdAt: 'desc' } } },
      });
      res.status(200).json(convs);
    } catch (err) {
      next(err);
    }
  }

  static async createConversation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { title } = req.body;
      const conv = await prisma.chatConversation.create({
        data: {
          userId,
          title: title || 'Scholarship Assistant Session',
        },
      });
      res.status(201).json(conv);
    } catch (err) {
      next(err);
    }
  }

  static async getMessages(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { conversationId } = req.params;
      const conv = await prisma.chatConversation.findFirst({
        where: { id: conversationId, userId },
        include: { messages: { orderBy: { createdAt: 'asc' }, take: 500 } },
      });

      if (!conv) return res.status(404).json({ error: 'Conversation not found' });
      res.status(200).json(conv);
    } catch (err) {
      next(err);
    }
  }

  static async deleteConversation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { conversationId } = req.params;

      const conv = await prisma.chatConversation.findFirst({
        where: { id: conversationId, userId },
      });

      if (!conv) return res.status(404).json({ error: 'Conversation not found or access denied' });

      await prisma.chatConversation.delete({
        where: { id: conversationId },
      });

      res.status(200).json({ message: 'Conversation deleted successfully' });
    } catch (err) {
      next(err);
    }
  }

  static async renameConversation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { conversationId } = req.params;
      const { title } = req.body;

      // Scope the write to the owner so the update itself cannot touch another user's row.
      const result = await prisma.chatConversation.updateMany({
        where: { id: conversationId, userId },
        data: { title },
      });

      if (result.count === 0) {
        return res.status(404).json({ error: 'Conversation not found or access denied' });
      }

      const updated = await prisma.chatConversation.findUnique({ where: { id: conversationId } });
      res.status(200).json(updated);
    } catch (err) {
      next(err);
    }
  }

  static async sendMessage(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      let { conversationId } = req.params;
      // Trimmed and length-capped by sendMessageSchema.
      const content: string = req.body.content;

      if (conversationId === 'new') {
        const newConv = await prisma.chatConversation.create({
          data: {
            userId,
            title: content.slice(0, 40) + (content.length > 40 ? '…' : ''),
          },
        });
        conversationId = newConv.id;
      }

      // Ownership is enforced inside processUserMessage, which scopes the
      // conversation lookup by userId and 404s on a mismatch.
      const reply = await OrchestratorAgent.processUserMessage(conversationId, userId, content);
      res.status(200).json({ conversationId, message: reply });
    } catch (err) {
      next(err);
    }
  }
}
