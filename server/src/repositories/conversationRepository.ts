import {
  Conversation,
  type ConversationCreateInput,
} from "../models/Conversation.js";

export const conversationRepository = {
  create(data: ConversationCreateInput) {
    return Conversation.create(data);
  },

  findById(id: string) {
    return Conversation.findById(id);
  },

  findByIdForUser(id: string, userId: string) {
    return Conversation.findOne({ _id: id, userId });
  },

  listForUser(userId: string, limit = 20) {
    return Conversation.find({ userId }).sort({ updatedAt: -1 }).limit(limit);
  },

  async incrementMessageCount(id: string, by = 1) {
    const conversation = await Conversation.findById(id);
    if (!conversation) return null;
    conversation.messageCount += by;
    if (conversation.startedAt && conversation.status !== "completed") {
      conversation.durationSeconds = Math.max(
        0,
        Math.floor((Date.now() - conversation.startedAt.getTime()) / 1000),
      );
    }
    await conversation.save();
    return conversation;
  },

  async refreshDuration(id: string) {
    const conversation = await Conversation.findById(id);
    if (!conversation?.startedAt) return null;
    const end = conversation.endedAt || new Date();
    conversation.durationSeconds = Math.max(
      0,
      Math.floor((end.getTime() - conversation.startedAt.getTime()) / 1000),
    );
    await conversation.save();
    return conversation;
  },

  deleteForUser(id: string, userId: string) {
    return Conversation.findOneAndDelete({ _id: id, userId });
  },
};
