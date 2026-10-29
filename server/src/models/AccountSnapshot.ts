import mongoose, { Schema, type HydratedDocument, type Model } from "mongoose";

const accountSnapshotSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);

accountSnapshotSchema.index({ userId: 1, periodEnd: -1 });

export type AccountSnapshotPayload = {
  userState: {
    name: string;
    pronouns: string;
    avatarUrl: string | null;
    onboardingCompleted: boolean;
  };
  settings: Record<string, unknown> | null;
  learningProfile: Record<string, unknown> | null;
  conversations: Record<string, unknown>[];
  messages: Record<string, unknown>[];
  conversationSummaries: Record<string, unknown>[];
  dictionaryEntries: Record<string, unknown>[];
  skillProgress: Record<string, unknown>[];
  quizHistory: Record<string, unknown>[];
  scenarioHistory: Record<string, unknown>[];
  customScenarios: Record<string, unknown>[];
};

export type AccountSnapshotDocument = HydratedDocument<{
  userId: mongoose.Types.ObjectId;
  periodStart: Date;
  periodEnd: Date;
  payload: AccountSnapshotPayload;
  createdAt: Date;
  updatedAt: Date;
}>;

export const AccountSnapshot: Model<AccountSnapshotDocument> =
  (mongoose.models.AccountSnapshot as Model<AccountSnapshotDocument> | undefined) ??
  mongoose.model<AccountSnapshotDocument>("AccountSnapshot", accountSnapshotSchema);
