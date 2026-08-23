import { Router } from 'express';
import { ChatController } from '../controllers/chatController';
import { authenticateToken } from '../middleware/auth';
import { validateRequest } from '../middleware/validate';
import { chatRateLimiter } from '../middleware/rateLimiter';
import {
  createConversationSchema,
  conversationIdSchema,
  renameConversationSchema,
  sendMessageSchema,
} from '../validators/chatValidator';

const router = Router();

router.use(authenticateToken);

router.get('/conversations', ChatController.listConversations);
router.post('/conversations', validateRequest(createConversationSchema), ChatController.createConversation);
router.get('/conversations/:conversationId', validateRequest(conversationIdSchema), ChatController.getMessages);
router.delete(
  '/conversations/:conversationId',
  validateRequest(conversationIdSchema),
  ChatController.deleteConversation
);
router.patch(
  '/conversations/:conversationId',
  validateRequest(renameConversationSchema),
  ChatController.renameConversation
);

// Rate limited: each message can fan out into several model round-trips.
router.post(
  '/conversations/:conversationId/messages',
  chatRateLimiter,
  validateRequest(sendMessageSchema),
  ChatController.sendMessage
);

export default router;
