import mongoose, { Schema, type HydratedDocument, type Model } from "mongoose";
import {
  PROFICIENCY_LEVELS,
  SUPPORTED_LANGUAGES,
} from "../constants/languages.js";

const dictionarySchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    word: { type: String, required: true, trim: true },
    language: {
      type: String,
      enum: SUPPORTED_LANGUAGES,
      required: true,
      index: true,
    },
    meaning: { type: String, required: true, trim: true },
    pronunciation: { type: String, default: "" },
    exampleSentence: { type: String, default: "" },
    userExample: { type: String, default: "" },
    category: { type: String, default: "General" },
    difficulty: {
      type: String,
      enum: PROFICIENCY_LEVELS,
      default: "Beginner",
    },
    masteryScore: { type: Number, default: 20, min: 0, max: 100 },
    timesReviewed: { type: Number, default: 0 },
    lastReviewed: { type: Date, default: null },
    nextReview: { type: Date, default: Date.now },
    favorite: { type: Boolean, default: false },
    notes: { type: String, default: "" },
    source: {
      type: String,
      enum: ["help", "manual", "correction", "summary"],
      default: "manual",
    },
  },
  { timestamps: true },
);

dictionarySchema.index({ userId: 1, language: 1, word: 1 }, { unique: true });
dictionarySchema.index({ userId: 1, masteryScore: 1 });
dictionarySchema.index({ userId: 1, nextReview: 1 });
dictionarySchema.index({ userId: 1, favorite: 1 });

export type DictionaryCreateInput = {
  userId: mongoose.Types.ObjectId;
  word: string;
  language: string;
  meaning: string;
  pronunciation?: string;
  exampleSentence?: string;
  userExample?: string;
  category?: string;
  difficulty?: string;
  masteryScore?: number;
  favorite?: boolean;
  notes?: string;
  source?: "help" | "manual" | "correction" | "summary";
  nextReview?: Date;
};

export type DictionaryDocument = HydratedDocument<{
  userId: mongoose.Types.ObjectId;
  word: string;
  language: string;
  meaning: string;
  pronunciation: string;
  exampleSentence: string;
  userExample: string;
  category: string;
  difficulty: string;
  masteryScore: number;
  timesReviewed: number;
  lastReviewed?: Date | null;
  nextReview?: Date | null;
  favorite: boolean;
  notes: string;
  source: "help" | "manual" | "correction" | "summary";
  createdAt: Date;
  updatedAt: Date;
}>;

export const DictionaryEntry: Model<DictionaryDocument> =
  (mongoose.models.DictionaryEntry as Model<DictionaryDocument> | undefined) ??
  mongoose.model<DictionaryDocument>("DictionaryEntry", dictionarySchema);
