import mongoose, { Schema, type HydratedDocument, type Model } from "mongoose";

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    pronouns: { type: String, default: "", trim: true, maxlength: 40 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    googleId: { type: String, unique: true, sparse: true, index: true },
    avatarUrl: { type: String, default: null },
    passwordHash: { type: String, default: null },
    emailVerified: { type: Boolean, default: false },
    refreshTokenHash: { type: String, default: null },
    passwordResetTokenHash: { type: String, default: null },
    passwordResetExpiresAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
    onboardingCompleted: { type: Boolean, default: false },
    accountStatus: {
      type: String,
      enum: ["active", "pending_deletion"],
      default: "active",
      index: true,
    },
    deletionScheduledAt: { type: Date, default: null },
    deletionPurgeAt: { type: Date, default: null },
    livePeriodStart: { type: Date, default: null },
  },
  { timestamps: true },
);

userSchema.index({ accountStatus: 1, deletionPurgeAt: 1 });

export type UserDocument = HydratedDocument<{
  name: string;
  pronouns: string;
  email: string;
  googleId?: string | null;
  avatarUrl?: string | null;
  passwordHash?: string | null;
  emailVerified: boolean;
  refreshTokenHash?: string | null;
  passwordResetTokenHash?: string | null;
  passwordResetExpiresAt?: Date | null;
  lastLoginAt?: Date | null;
  onboardingCompleted: boolean;
  accountStatus: "active" | "pending_deletion";
  deletionScheduledAt?: Date | null;
  deletionPurgeAt?: Date | null;
  livePeriodStart?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}>;

export const User: Model<UserDocument> =
  (mongoose.models.User as Model<UserDocument> | undefined) ??
  mongoose.model<UserDocument>("User", userSchema);
