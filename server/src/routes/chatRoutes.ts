import { Router } from "express";
import rateLimit from "express-rate-limit";
import { chatController } from "../controllers/chatController.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

export const chatRoutes = Router();

chatRoutes.use(requireAuth);

chatRoutes.get(
  "/conversations",
  asyncHandler(chatController.listConversations),
);
chatRoutes.post(
  "/conversations",
  asyncHandler(chatController.createConversation),
);
chatRoutes.get(
  "/conversations/:id",
  asyncHandler(chatController.getConversation),
);
chatRoutes.post(
  "/conversations/:id/messages",
  chatLimiter,
  asyncHandler(chatController.sendMessage),
);
chatRoutes.post(
  "/conversations/:id/messages/:messageId/regenerate",
  chatLimiter,
  asyncHandler(chatController.regenerateMessage),
);
chatRoutes.post(
  "/conversations/:id/end",
  asyncHandler(chatController.endConversation),
);
chatRoutes.delete(
  "/conversations/:id",
  asyncHandler(chatController.deleteConversation),
);
