import { z } from "zod";
import {
  PROFICIENCY_LEVELS,
  SUPPORTED_LANGUAGES,
  TUTOR_PERSONALITIES,
} from "../constants/languages.js";

const LEARNING_GOALS = [
  "Travel",
  "Work",
  "School",
  "Exam",
  "Moving Abroad",
  "Fun",
  "Conversation",
  "Business",
] as const;

export const updateSettingsSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  pronouns: z.string().trim().max(40).optional(),
  targetLanguage: z.enum(SUPPORTED_LANGUAGES).optional(),
  level: z.enum(PROFICIENCY_LEVELS).optional(),
  tutorPersonality: z.enum(TUTOR_PERSONALITIES).optional(),
  dailyGoalMinutes: z.number().int().min(5).max(120).optional(),
  learningGoal: z.union([z.enum(LEARNING_GOALS), z.string().trim().min(2).max(80)]).optional(),
  preferredTopics: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  theme: z.enum(["light", "dark"]).optional(),
  notificationsEnabled: z.boolean().optional(),
  showEnglishUnderReplies: z.boolean().optional(),
});

export const completeOnboardingSchema = z.object({
  targetLanguage: z.enum(SUPPORTED_LANGUAGES),
  level: z.enum(PROFICIENCY_LEVELS),
  learningGoal: z.union([z.enum(LEARNING_GOALS), z.string().trim().min(2).max(80)]),
  dailyGoalMinutes: z.number().int().min(5).max(120),
  tutorPersonality: z.enum(TUTOR_PERSONALITIES),
  preferredTopics: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
});
