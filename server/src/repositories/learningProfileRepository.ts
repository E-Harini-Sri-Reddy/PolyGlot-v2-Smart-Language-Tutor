import { LearningProfile, type LearningProfileDocument } from "../models/LearningProfile.js";

export const learningProfileRepository = {
  findByUserId(userId: string) {
    return LearningProfile.findOne({ userId });
  },

  createForUser(userId: string) {
    return LearningProfile.create({ userId });
  },

  async save(profile: LearningProfileDocument) {
    return profile.save();
  },
};
