import { z } from 'zod';

export const createConversationSchema = z.object({
  body: z
    .object({
      title: z.string().trim().min(1).max(120).optional(),
    })
    .strip(),
});

export const conversationIdSchema = z.object({
  // "new" is accepted by sendMessage so the client can post before a conversation exists.
  params: z.object({ conversationId: z.string().min(1).max(64) }),
});

export const renameConversationSchema = z.object({
  params: z.object({ conversationId: z.string().uuid('A valid conversation id is required') }),
  body: z
    .object({
      title: z.string().trim().min(1, 'Title is required').max(120, 'Title must be 120 characters or fewer'),
    })
    .strip(),
});

/**
 * Message length is capped because content flows straight into the model context.
 * An unbounded body is both a token-cost and a context-window problem.
 */
export const sendMessageSchema = z.object({
  params: z.object({ conversationId: z.string().min(1).max(64) }),
  body: z
    .object({
      content: z
        .string()
        .trim()
        .min(1, 'Message content is required')
        .max(4000, 'Message must be 4000 characters or fewer'),
    })
    .strip(),
});
