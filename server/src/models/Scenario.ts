import mongoose, { Schema, type HydratedDocument, type Model } from "mongoose";
import { PROFICIENCY_LEVELS } from "../constants/languages.js";

const scenarioSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    category: { type: String, required: true, index: true },
    difficulty: {
      type: String,
      enum: PROFICIENCY_LEVELS,
      required: true,
      index: true,
    },
    description: { type: String, default: "" },
    learningGoal: { type: String, default: "" },
    grammarFocus: { type: [String], default: [] },
    vocabularyTags: { type: [String], default: [] },
    conversationFlow: { type: [String], default: [] },
    estimatedMinutes: { type: Number, default: 10 },
    promptTemplate: { type: String, required: true },
    isPreset: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    icon: { type: String, default: "💬" },
  },
  { timestamps: true },
);

scenarioSchema.index({ title: 1, isPreset: 1 });

export type ScenarioCreateInput = {
  title: string;
  category: string;
  difficulty: string;
  description?: string;
  learningGoal?: string;
  grammarFocus?: string[];
  vocabularyTags?: string[];
  conversationFlow?: string[];
  estimatedMinutes?: number;
  promptTemplate: string;
  isPreset?: boolean;
  createdBy?: mongoose.Types.ObjectId | null;
  icon?: string;
};

export type ScenarioDocument = HydratedDocument<{
  title: string;
  category: string;
  difficulty: string;
  description: string;
  learningGoal: string;
  grammarFocus: string[];
  vocabularyTags: string[];
  conversationFlow: string[];
  estimatedMinutes: number;
  promptTemplate: string;
  isPreset: boolean;
  createdBy?: mongoose.Types.ObjectId | null;
  icon: string;
  createdAt: Date;
  updatedAt: Date;
}>;

export const Scenario: Model<ScenarioDocument> =
  (mongoose.models.Scenario as Model<ScenarioDocument> | undefined) ??
  mongoose.model<ScenarioDocument>("Scenario", scenarioSchema);
