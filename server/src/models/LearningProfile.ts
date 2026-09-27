import mongoose, { Schema, type HydratedDocument, type Model } from "mongoose";

const commonMistakeSchema = new Schema(
  {
    topic: { type: String, required: true },
    count: { type: Number, default: 1 },
  },
  { _id: false },
);

const learningProfileSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    estimatedCEFR: {
      type: String,
      enum: ["A1", "A2", "B1", "B2", "C1", "C2"],
      default: "A1",
    },
    vocabularyScore: { type: Number, default: 0, min: 0, max: 100 },
    grammarScore: { type: Number, default: 0, min: 0, max: 100 },
    conversationConfidence: { type: Number, default: 40, min: 0, max: 100 },
    readingScore: { type: Number, default: 0, min: 0, max: 100 },
    strengths: { type: [String], default: [] },
    weaknesses: { type: [String], default: [] },
    commonMistakes: { type: [commonMistakeSchema], default: [] },
    favoriteTopics: { type: [String], default: [] },
    recentVocabulary: { type: [String], default: [] },
    masteredTopics: { type: [String], default: [] },
    learningSpeed: {
      type: String,
      enum: ["slow", "medium", "fast"],
      default: "medium",
    },
    totalConversations: { type: Number, default: 0 },
    totalMessages: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export type LearningProfileDocument = HydratedDocument<{
  userId: mongoose.Types.ObjectId;
  estimatedCEFR: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
  vocabularyScore: number;
  grammarScore: number;
  conversationConfidence: number;
  readingScore: number;
  strengths: string[];
  weaknesses: string[];
  commonMistakes: Array<{ topic: string; count: number }>;
  favoriteTopics: string[];
  recentVocabulary: string[];
  masteredTopics: string[];
  learningSpeed: "slow" | "medium" | "fast";
  totalConversations: number;
  totalMessages: number;
  createdAt: Date;
  updatedAt: Date;
}>;

export const LearningProfile: Model<LearningProfileDocument> =
  (mongoose.models.LearningProfile as Model<LearningProfileDocument> | undefined) ??
  mongoose.model<LearningProfileDocument>("LearningProfile", learningProfileSchema);
