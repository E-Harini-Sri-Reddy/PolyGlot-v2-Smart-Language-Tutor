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
  },
  { timestamps: true },
);

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
  createdAt: Date;
  updatedAt: Date;
}>;

export const User: Model<UserDocument> =
  (mongoose.models.User as Model<UserDocument> | undefined) ??
  mongoose.model<UserDocument>("User", userSchema);
