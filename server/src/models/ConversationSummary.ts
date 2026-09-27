import mongoose, { Schema, type HydratedDocument, type Model } from "mongoose";

const conversationSummarySchema = new Schema(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    language: { type: String, index: true, default: "" },
    summary: { type: String, required: true },
    importantVocabulary: { type: [String], default: [] },
    grammarFocus: { type: [String], default: [] },
    strengthsObserved: { type: [String], default: [] },
    weaknessesObserved: { type: [String], default: [] },
    messageWindowStart: { type: Number, default: 0 },
    messageWindowEnd: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: true } },
);

conversationSummarySchema.index({ userId: 1, language: 1, createdAt: -1 });
conversationSummarySchema.index({ userId: 1, createdAt: -1 });

export type ConversationSummaryCreateInput = {
  conversationId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  language: string;
  summary: string;
  importantVocabulary?: string[];
  grammarFocus?: string[];
  strengthsObserved?: string[];
  weaknessesObserved?: string[];
  messageWindowStart?: number;
  messageWindowEnd?: number;
};

export type ConversationSummaryDocument = HydratedDocument<{
  conversationId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  language: string;
  summary: string;
  importantVocabulary: string[];
  grammarFocus: string[];
  strengthsObserved: string[];
  weaknessesObserved: string[];
  messageWindowStart: number;
  messageWindowEnd: number;
  createdAt: Date;
  updatedAt: Date;
}>;

export const ConversationSummary: Model<ConversationSummaryDocument> =
  (mongoose.models.ConversationSummary as
    | Model<ConversationSummaryDocument>
    | undefined) ??
  mongoose.model<ConversationSummaryDocument>(
    "ConversationSummary",
    conversationSummarySchema,
  );
