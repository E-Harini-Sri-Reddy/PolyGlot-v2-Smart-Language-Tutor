import mongoose from "mongoose";
import {
  ConversationSummary,
  type ConversationSummaryCreateInput,
} from "../models/ConversationSummary.js";

export const conversationSummaryRepository = {
  create(data: ConversationSummaryCreateInput) {
    return ConversationSummary.create(data);
  },

  async listRecentForUser(userId: string, limit = 5, language?: string) {
    if (!language) {
      return ConversationSummary.find({ userId })
        .sort({ createdAt: -1 })
        .limit(limit);
    }

    const rows = await ConversationSummary.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      {
        $lookup: {
          from: "conversations",
          localField: "conversationId",
          foreignField: "_id",
          as: "conversation",
        },
      },
      {
        $addFields: {
          resolvedLanguage: {
            $ifNull: [
              "$language",
              { $arrayElemAt: ["$conversation.language", 0] },
            ],
          },
        },
      },
      { $match: { resolvedLanguage: language } },
      { $sort: { createdAt: -1 } },
      { $limit: limit },
      {
        $project: {
          conversationId: 1,
          userId: 1,
          language: "$resolvedLanguage",
          summary: 1,
          importantVocabulary: 1,
          grammarFocus: 1,
          strengthsObserved: 1,
          weaknessesObserved: 1,
          messageWindowStart: 1,
          messageWindowEnd: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
    ]);

    return rows;
  },

  listForConversation(conversationId: string) {
    return ConversationSummary.find({ conversationId }).sort({ createdAt: 1 });
  },

  countForConversation(conversationId: string) {
    return ConversationSummary.countDocuments({ conversationId });
  },

  deleteByConversation(conversationId: string) {
    return ConversationSummary.deleteMany({ conversationId });
  },
};
