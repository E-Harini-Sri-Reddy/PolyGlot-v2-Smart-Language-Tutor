import mongoose, { Schema, type Model } from "mongoose";

const correctionSchema = new Schema(
  {
    encourage: { type: String, default: "" },
    corrected: { type: String, default: "" },
    translation: { type: String, default: "" },
    wordByWord: {
      type: [
        {
          word: { type: String, default: "" },
          meaning: { type: String, default: "" },
        },
      ],
      default: [],
    },
    explain: { type: String, default: "" },
    why: { type: String, default: "" },
  },
  { _id: false },
);

const messageSchema = new Schema(
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
    role: {
      type: String,
      enum: ["user", "assistant", "system"],
      required: true,
    },
    content: { type: String, required: true },
    language: { type: String, default: null },
    metadata: {
      corrections: { type: [correctionSchema], default: [] },
      newWords: { type: [String], default: [] },
      grammarTopics: { type: [String], default: [] },
      helpMode: { type: Boolean, default: false },
    },
    audioUrl: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

messageSchema.index({ conversationId: 1, createdAt: 1 });

export type MessageCreateInput = {
  conversationId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  role: "user" | "assistant" | "system";
  content: string;
  language?: string | null;
  metadata?: {
    corrections?: Array<{
      encourage?: string;
      corrected?: string;
      translation?: string;
      wordByWord?: Array<{ word?: string; meaning?: string }>;
      explain?: string;
      why?: string;
    }>;
    newWords?: string[];
    grammarTopics?: string[];
    helpMode?: boolean;
  };
  audioUrl?: string | null;
};

export type MessageDocument = mongoose.HydratedDocument<{
  conversationId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  role: "user" | "assistant" | "system";
  content: string;
  language?: string | null;
  metadata: {
    corrections: Array<{
      encourage: string;
      corrected: string;
      translation: string;
      wordByWord: Array<{ word: string; meaning: string }>;
      explain: string;
      why: string;
    }>;
    newWords: string[];
    grammarTopics: string[];
    helpMode: boolean;
  };
  audioUrl?: string | null;
  createdAt: Date;
}>;

export const Message: Model<MessageDocument> =
  (mongoose.models.Message as Model<MessageDocument> | undefined) ??
  mongoose.model<MessageDocument>("Message", messageSchema);
