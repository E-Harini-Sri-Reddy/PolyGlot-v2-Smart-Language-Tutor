import type { Request, Response } from "express";
import { chatService } from "../services/chatService.js";
import {
  createConversationSchema,
  sendMessageSchema,
} from "../validators/chatValidators.js";

export const chatController = {
  async createConversation(req: Request, res: Response) {
    const userId = (req as Request & { user: { id: string } }).user.id;
    const body = createConversationSchema.parse(req.body);
    const result = await chatService.createConversation(userId, body);
    res.status(201).json({
      success: true,
      conversation: result.conversation,
      message: result.message,
    });
  },

  async listConversations(req: Request, res: Response) {
    const userId = (req as Request & { user: { id: string } }).user.id;
    const conversations = await chatService.listConversations(userId);
    res.json({ success: true, conversations });
  },

  async getConversation(req: Request, res: Response) {
    const userId = (req as Request & { user: { id: string } }).user.id;
    const conversationId = String(req.params.id);
    const result = await chatService.getConversation(userId, conversationId);
    res.json({ success: true, ...result });
  },

  async sendMessage(req: Request, res: Response) {
    const userId = (req as Request & { user: { id: string } }).user.id;
    const conversationId = String(req.params.id);
    const body = sendMessageSchema.parse(req.body);

    if (body.stream) {
      await chatService.sendMessage(userId, conversationId, body.content, res);
      return;
    }

    const result = await chatService.sendMessage(
      userId,
      conversationId,
      body.content,
    );
    res.json({ success: true, ...result });
  },

  async endConversation(req: Request, res: Response) {
    const userId = (req as Request & { user: { id: string } }).user.id;
    const conversationId = String(req.params.id);
    const result = await chatService.endConversation(userId, conversationId);
    res.json({ success: true, ...result });
  },

  async deleteConversation(req: Request, res: Response) {
    const userId = (req as Request & { user: { id: string } }).user.id;
    const conversationId = String(req.params.id);
    const result = await chatService.deleteConversation(userId, conversationId);
    res.json({ success: true, ...result });
  },
};
