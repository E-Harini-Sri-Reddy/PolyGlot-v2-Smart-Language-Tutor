import mongoose, { Schema, type HydratedDocument, type Model } from "mongoose";
import { PROFICIENCY_LEVELS } from "../constants/languages.js";

const scenarioHistorySchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    scenarioId: {
      type: Schema.Types.ObjectId,
      ref: "Scenario",
      required: true,
      index: true,
    },
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      default: null,
    },
    completedAt: { type: Date, default: Date.now },
    difficulty: { type: String, enum: PROFICIENCY_LEVELS, required: true },
    performanceScore: { type: Number, default: 70, min: 0, max: 100 },
    customPrompt: { type: String, default: "" },
  },
  { timestamps: true },
);

scenarioHistorySchema.index({ userId: 1, completedAt: -1 });

export type ScenarioHistoryCreateInput = {
  userId: mongoose.Types.ObjectId;
  scenarioId: mongoose.Types.ObjectId;
  conversationId?: mongoose.Types.ObjectId | null;
  difficulty: string;
  performanceScore?: number;
  customPrompt?: string;
  completedAt?: Date;
};

export type ScenarioHistoryDocument = HydratedDocument<{
  userId: mongoose.Types.ObjectId;
  scenarioId: mongoose.Types.ObjectId;
  conversationId?: mongoose.Types.ObjectId | null;
  completedAt: Date;
  difficulty: string;
  performanceScore: number;
  customPrompt: string;
  createdAt: Date;
  updatedAt: Date;
}>;

export const ScenarioHistory: Model<ScenarioHistoryDocument> =
  (mongoose.models.ScenarioHistory as Model<ScenarioHistoryDocument> | undefined) ??
  mongoose.model<ScenarioHistoryDocument>("ScenarioHistory", scenarioHistorySchema);
