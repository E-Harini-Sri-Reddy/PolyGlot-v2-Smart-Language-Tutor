import mongoose, { Schema, type HydratedDocument, type Model } from "mongoose";

const skillHistorySchema = new Schema(
  {
    date: { type: Date, default: Date.now },
    score: { type: Number, required: true },
  },
  { _id: false },
);

const skillProgressSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    skill: {
      type: String,
      enum: [
        "Vocabulary",
        "Grammar",
        "Conversation Confidence",
        "Reading",
        "Listening",
        "Speaking",
        "Pronunciation",
      ],
      required: true,
    },
    score: { type: Number, default: 0, min: 0, max: 100 },
    history: { type: [skillHistorySchema], default: [] },
  },
  { timestamps: true },
);

skillProgressSchema.index({ userId: 1, skill: 1 }, { unique: true });

export type SkillProgressDocument = HydratedDocument<{
  userId: mongoose.Types.ObjectId;
  skill: string;
  score: number;
  history: Array<{ date: Date; score: number }>;
  createdAt: Date;
  updatedAt: Date;
}>;

export const SkillProgress: Model<SkillProgressDocument> =
  (mongoose.models.SkillProgress as Model<SkillProgressDocument> | undefined) ??
  mongoose.model<SkillProgressDocument>("SkillProgress", skillProgressSchema);
