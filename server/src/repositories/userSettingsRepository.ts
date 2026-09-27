import { UserSettings } from "../models/UserSettings.js";

export const userSettingsRepository = {
  findByUserId(userId: string) {
    return UserSettings.findOne({ userId });
  },

  createForUser(userId: string) {
    return UserSettings.create({ userId });
  },

  async upsert(userId: string, updates: Record<string, unknown>) {
    return UserSettings.findOneAndUpdate(
      { userId },
      { $set: updates },
      { new: true, upsert: true },
    );
  },
};
