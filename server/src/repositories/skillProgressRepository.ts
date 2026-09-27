import mongoose from "mongoose";
import { SkillProgress } from "../models/SkillProgress.js";

const CORE_SKILLS = [
  "Vocabulary",
  "Grammar",
  "Conversation Confidence",
  "Reading",
] as const;

export const skillProgressRepository = {
  async ensureDefaults(userId: string) {
    const existing = await SkillProgress.find({ userId });
    const have = new Set(existing.map((item) => item.skill));
    const missing = CORE_SKILLS.filter((skill) => !have.has(skill));
    if (missing.length) {
      await SkillProgress.insertMany(
        missing.map((skill) => ({
          userId: new mongoose.Types.ObjectId(userId),
          skill,
          score: skill === "Conversation Confidence" ? 40 : 10,
          history: [
            {
              date: new Date(),
              score: skill === "Conversation Confidence" ? 40 : 10,
            },
          ],
        })),
      );
    }
    return SkillProgress.find({ userId }).sort({ skill: 1 });
  },

  async upsertScore(userId: string, skill: string, score: number) {
    const clamped = Math.max(0, Math.min(100, Math.round(score)));
    return SkillProgress.findOneAndUpdate(
      { userId, skill },
      {
        $set: { score: clamped },
        $push: {
          history: {
            $each: [{ date: new Date(), score: clamped }],
            $slice: -30,
          },
        },
      },
      { upsert: true, new: true },
    );
  },

  listForUser(userId: string) {
    return SkillProgress.find({ userId }).sort({ skill: 1 });
  },
};
