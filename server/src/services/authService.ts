import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import { env } from "../config/env.js";
import { userRepository } from "../repositories/userRepository.js";
import { userSettingsRepository } from "../repositories/userSettingsRepository.js";
import { AppError } from "../utils/errors.js";
import {
  signAccessToken,
  signRefreshToken,
} from "../utils/tokens.js";
import {
  generateSecureToken,
  hashToken,
  sendPasswordResetEmail,
} from "./emailService.js";

const googleClient = env.GOOGLE_CLIENT_ID
  ? new OAuth2Client(env.GOOGLE_CLIENT_ID)
  : null;

function publicUser(user: {
  _id: { toString(): string };
  name: string;
  email: string;
  avatarUrl?: string | null;
  onboardingCompleted?: boolean | null;
  pronouns?: string | null;
}) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl ?? null,
    onboardingCompleted: Boolean(user.onboardingCompleted),
    pronouns: user.pronouns ?? "",
  };
}

async function issueTokens(userId: string, email: string) {
  const accessToken = signAccessToken(userId, email);
  const refreshToken = signRefreshToken(userId);
  const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

  const user = await userRepository.findById(userId);
  if (!user) {
    throw new AppError(404, "USER_NOT_FOUND", "User not found.");
  }

  user.refreshTokenHash = refreshTokenHash;
  user.lastLoginAt = new Date();
  await userRepository.save(user);

  return { accessToken, refreshToken, user: publicUser(user) };
}

export const authService = {
  async register(input: { name: string; email: string; password: string }) {
    const existing = await userRepository.findByEmail(input.email);
    if (existing) {
      throw new AppError(409, "EMAIL_IN_USE", "An account with this email already exists.");
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await userRepository.create({
      name: input.name,
      email: input.email.toLowerCase(),
      passwordHash,
      emailVerified: false,
    });

    await userSettingsRepository.createForUser(user._id.toString());
    const { learningDnaService } = await import("./learningDnaService.js");
    await learningDnaService.getOrCreate(user._id.toString());
    return issueTokens(user._id.toString(), user.email);
  },

  async login(input: { email: string; password: string }) {
    const user = await userRepository.findByEmail(input.email);
    if (!user || !user.passwordHash) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password.");
    }

    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password.");
    }

    return issueTokens(user._id.toString(), user.email);
  },

  async googleLogin(idToken: string) {
    if (!googleClient || !env.GOOGLE_CLIENT_ID) {
      throw new AppError(
        503,
        "GOOGLE_AUTH_UNAVAILABLE",
        "Google sign-in is not configured yet.",
      );
    }

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.email || !payload.sub) {
      throw new AppError(401, "INVALID_GOOGLE_TOKEN", "Could not verify Google account.");
    }

    let user =
      (await userRepository.findByGoogleId(payload.sub)) ||
      (await userRepository.findByEmail(payload.email));

    if (user) {
      if (!user.googleId) {
        user.googleId = payload.sub;
      }
      if (!user.avatarUrl && payload.picture) {
        user.avatarUrl = payload.picture;
      }
      user.emailVerified = true;
      await userRepository.save(user);
    } else {
      user = await userRepository.create({
        name: payload.name || payload.email.split("@")[0] || "Learner",
        email: payload.email.toLowerCase(),
        googleId: payload.sub,
        avatarUrl: payload.picture ?? null,
        emailVerified: true,
      });
      await userSettingsRepository.createForUser(user._id.toString());
      const { learningDnaService } = await import("./learningDnaService.js");
      await learningDnaService.getOrCreate(user._id.toString());
    }

    return issueTokens(user._id.toString(), user.email);
  },

  async refresh(refreshToken: string) {
    const { verifyRefreshToken } = await import("../utils/tokens.js");
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new AppError(401, "INVALID_REFRESH_TOKEN", "Session expired. Please log in again.");
    }

    const user = await userRepository.findById(payload.sub);
    if (!user?.refreshTokenHash) {
      throw new AppError(401, "INVALID_REFRESH_TOKEN", "Session expired. Please log in again.");
    }

    const matches = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!matches) {
      throw new AppError(401, "INVALID_REFRESH_TOKEN", "Session expired. Please log in again.");
    }

    return issueTokens(user._id.toString(), user.email);
  },

  async logout(userId: string) {
    const user = await userRepository.findById(userId);
    if (user) {
      user.refreshTokenHash = null;
      await userRepository.save(user);
    }
  },

  async me(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new AppError(404, "USER_NOT_FOUND", "User not found.");
    }
    const settings = await userSettingsRepository.findByUserId(userId);
    return { user: publicUser(user), settings };
  },

  async forgotPassword(email: string) {
    const user = await userRepository.findByEmail(email);
    // Always return success to avoid email enumeration
    if (!user) {
      return { message: "If that email exists, a reset link has been sent." };
    }

    const token = generateSecureToken();
    user.passwordResetTokenHash = hashToken(token);
    user.passwordResetExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await userRepository.save(user);

    const resetUrl = `${env.CLIENT_URL}/reset-password?token=${token}`;
    await sendPasswordResetEmail(user.email, resetUrl);

    return { message: "If that email exists, a reset link has been sent." };
  },

  async resetPassword(token: string, password: string) {
    const tokenHash = hashToken(token);
    const { User } = await import("../models/User.js");
    const found = await User.findOne({
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: { $gt: new Date() },
    });

    if (!found) {
      throw new AppError(400, "INVALID_RESET_TOKEN", "Reset link is invalid or expired.");
    }

    found.passwordHash = await bcrypt.hash(password, 12);
    found.passwordResetTokenHash = null;
    found.passwordResetExpiresAt = null;
    found.refreshTokenHash = null;
    await userRepository.save(found);

    return { message: "Password updated. You can log in now." };
  },
};
