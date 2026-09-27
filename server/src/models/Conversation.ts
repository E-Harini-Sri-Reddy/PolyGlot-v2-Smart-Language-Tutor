import mongoose, { Schema, type HydratedDocument, type Model } from "mongoose";
import { SUPPORTED_LANGUAGES } from "../constants/languages.js";

const conversationSchema = new Schema(
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
    type: {
      type: String,
      enum: ["scenario", "free", "custom"],
      default: "free",
    },
    scenarioId: { type: Schema.Types.ObjectId, ref: "Scenario", default: null },
    title: { type: String, required: true },
    scenarioText: { type: String, default: "" },
    level: { type: String, required: true },
    status: {
      type: String,
      enum: ["active", "completed", "abandoned"],
      default: "active",
    },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date, default: null },
    messageCount: { type: Number, default: 0 },
    durationSeconds: { type: Number, default: 0 },
  },
  { timestamps: true },
);

conversationSchema.index({ userId: 1, createdAt: -1 });

export type ConversationDocument = HydratedDocument<{
  userId: mongoose.Types.ObjectId;
  language: string;
  type: "scenario" | "free" | "custom";
  scenarioId?: mongoose.Types.ObjectId | null;
  title: string;
  scenarioText?: string;
  level: string;
  status: "active" | "completed" | "abandoned";
  startedAt: Date;
  endedAt?: Date | null;
  messageCount: number;
  durationSeconds: number;
  createdAt: Date;
  updatedAt: Date;
}>;

export type ConversationCreateInput = {
  userId: mongoose.Types.ObjectId;
  language: string;
  type?: "scenario" | "free" | "custom";
  scenarioId?: mongoose.Types.ObjectId | null;
  title: string;
  scenarioText?: string;
  level: string;
  status?: "active" | "completed" | "abandoned";
};

export const Conversation: Model<ConversationDocument> =
  (mongoose.models.Conversation as Model<ConversationDocument> | undefined) ??
  mongoose.model<ConversationDocument>("Conversation", conversationSchema);
