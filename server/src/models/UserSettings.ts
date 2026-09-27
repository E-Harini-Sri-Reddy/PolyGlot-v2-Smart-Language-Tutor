import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import {
  PROFICIENCY_LEVELS,
  SUPPORTED_LANGUAGES,
  TUTOR_PERSONALITIES,
} from "../constants/languages.js";

const userSettingsSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    targetLanguage: {
      type: String,
      enum: SUPPORTED_LANGUAGES,
      default: "Spanish",
    },
    nativeLanguage: { type: String, default: "English" },
    level: {
      type: String,
      enum: PROFICIENCY_LEVELS,
      default: "Beginner",
    },
    tutorPersonality: {
      type: String,
      enum: TUTOR_PERSONALITIES,
      default: "Friendly Teacher",
    },
    theme: { type: String, enum: ["light", "dark"], default: "dark" },
    notificationsEnabled: { type: Boolean, default: true },
    dailyGoalMinutes: { type: Number, default: 15 },
    learningGoal: { type: String, default: "Conversation" },
    preferredTopics: { type: [String], default: [] },
  },
  { timestamps: true },
);

export type UserSettingsDocument = InferSchemaType<typeof userSettingsSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const UserSettings: Model<UserSettingsDocument> =
  mongoose.models.UserSettings ??
  mongoose.model<UserSettingsDocument>("UserSettings", userSettingsSchema);
