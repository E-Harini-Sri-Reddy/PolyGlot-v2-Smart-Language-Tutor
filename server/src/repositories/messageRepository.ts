import { Message, type MessageCreateInput, type MessageDocument } from "../models/Message.js";

export const messageRepository = {
  create(data: MessageCreateInput) {
    return Message.create(data);
  },

  listByConversation(conversationId: string, limit = 100) {
    return Message.find({ conversationId }).sort({ createdAt: 1 }).limit(limit);
  },

  listRecent(conversationId: string, limit = 25) {
    return Message.find({ conversationId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .then((msgs: MessageDocument[]) => msgs.reverse());
  },

  deleteByConversation(conversationId: string) {
    return Message.deleteMany({ conversationId });
  },

  findById(messageId: string) {
    return Message.findById(messageId);
  },

  deleteById(messageId: string) {
    return Message.findByIdAndDelete(messageId);
  },
};
