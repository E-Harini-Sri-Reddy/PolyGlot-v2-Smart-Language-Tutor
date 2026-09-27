import mongoose, { Schema, type HydratedDocument, type Model } from "mongoose";
import { SUPPORTED_LANGUAGES } from "../constants/languages.js";

const quizQuestionSchema = new Schema(
  {
    type: {
      type: String,
      enum: [
        "multiple_choice",
        "fill_blank",
        "translation",
        "grammar_correction",
        "sentence_building",
        "conversation_continuation",
      ],
      required: true,
    },
    prompt: { type: String, required: true },
    options: { type: [String], default: [] },
    answer: { type: String, required: true },
    explanation: { type: String, default: "" },
    sourceWord: { type: String, default: "" },
  },
  { _id: false },
);

const quizHistorySchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    language: {
      type: String,
      enum: SUPPORTED_LANGUAGES,
      required: true,
    },
    topic: { type: String, default: "Mixed review" },
    questions: { type: [quizQuestionSchema], default: [] },
    userAnswers: { type: [String], default: [] },
    score: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    completedAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ["active", "completed"],
      default: "active",
    },
  },
  { timestamps: true },
);

quizHistorySchema.index({ userId: 1, createdAt: -1 });

export type QuizQuestion = {
  type:
    | "multiple_choice"
    | "fill_blank"
    | "translation"
    | "grammar_correction"
    | "sentence_building"
    | "conversation_continuation";
  prompt: string;
  options?: string[];
  answer: string;
  explanation?: string;
  sourceWord?: string;
};

export type QuizHistoryCreateInput = {
  userId: mongoose.Types.ObjectId;
  language: string;
  topic?: string;
  questions: QuizQuestion[];
  total: number;
  status?: "active" | "completed";
};

export type QuizHistoryDocument = HydratedDocument<{
  userId: mongoose.Types.ObjectId;
  language: string;
  topic: string;
  questions: QuizQuestion[];
  userAnswers: string[];
  score: number;
  total: number;
  completedAt?: Date | null;
  status: "active" | "completed";
  createdAt: Date;
  updatedAt: Date;
}>;

export const QuizHistory: Model<QuizHistoryDocument> =
  (mongoose.models.QuizHistory as Model<QuizHistoryDocument> | undefined) ??
  mongoose.model<QuizHistoryDocument>("QuizHistory", quizHistorySchema);
