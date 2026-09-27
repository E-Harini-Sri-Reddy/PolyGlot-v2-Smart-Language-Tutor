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
    return Conversation.findByIdAndUpdate(
      id,
      { $inc: { messageCount: by } },
      { new: true },
    );
  },

  deleteForUser(id: string, userId: string) {
    return Conversation.findOneAndDelete({ _id: id, userId });
  },
};
