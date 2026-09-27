import { userRepository } from "../repositories/userRepository.js";
import { userSettingsRepository } from "../repositories/userSettingsRepository.js";
import { AppError } from "../utils/errors.js";
import type { z } from "zod";
import type {
  completeOnboardingSchema,
  updateSettingsSchema,
} from "../validators/settingsValidators.js";

function toPublicSettings(
  settings: Awaited<ReturnType<typeof userSettingsRepository.findByUserId>>,
  user: { name: string; pronouns?: string | null } | null,
) {
  if (!settings) return null;
  return {
    ...settings.toObject(),
    name: user?.name ?? "",
    pronouns: user?.pronouns ?? "",
  };
}

export const settingsService = {
  async getSettings(userId: string) {
    let settings = await userSettingsRepository.findByUserId(userId);
    if (!settings) {
      settings = await userSettingsRepository.createForUser(userId);
    }
    const user = await userRepository.findById(userId);
    return {
      settings: toPublicSettings(settings, user),
      onboardingCompleted: Boolean(user?.onboardingCompleted),
    };
  },

  async updateSettings(
    userId: string,
    updates: z.infer<typeof updateSettingsSchema>,
  ) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new AppError(404, "USER_NOT_FOUND", "User not found.");
    }

    const { name, pronouns, ...settingsUpdates } = updates;

    if (typeof name === "string") {
      user.name = name;
    }
    if (typeof pronouns === "string") {
      user.pronouns = pronouns;
    }
    if (typeof name === "string" || typeof pronouns === "string") {
      await userRepository.save(user);
    }

    const settingsDoc =
      Object.keys(settingsUpdates).length > 0
        ? await userSettingsRepository.upsert(userId, settingsUpdates)
        : (await userSettingsRepository.findByUserId(userId)) ||
          (await userSettingsRepository.createForUser(userId));

    return toPublicSettings(settingsDoc, user);
  },

  async completeOnboarding(
    userId: string,
    input: z.infer<typeof completeOnboardingSchema>,
  ) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new AppError(404, "USER_NOT_FOUND", "User not found.");
    }

    await userSettingsRepository.upsert(userId, {
      targetLanguage: input.targetLanguage,
      level: input.level,
      learningGoal: input.learningGoal,
      dailyGoalMinutes: input.dailyGoalMinutes,
      tutorPersonality: input.tutorPersonality,
      preferredTopics: input.preferredTopics,
    });

    user.onboardingCompleted = true;
    await userRepository.save(user);

    return {
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl ?? null,
        onboardingCompleted: true,
        pronouns: user.pronouns ?? "",
      },
      settings: toPublicSettings(
        await userSettingsRepository.findByUserId(userId),
        user,
      ),
    };
  },
};
