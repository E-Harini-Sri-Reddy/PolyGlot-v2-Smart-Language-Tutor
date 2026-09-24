import { z } from "zod";
import {
  PROFICIENCY_LEVELS,
  SUPPORTED_LANGUAGES,
} from "../constants/languages.js";

export const createConversationSchema = z.object({
  language: z.enum(SUPPORTED_LANGUAGES),
  level: z.enum(PROFICIENCY_LEVELS),
  scenario: z.string().trim().max(500).optional(),
  scenarioId: z.string().trim().optional(),
  customScenario: z.string().trim().max(500).optional(),
  title: z.string().trim().max(120).optional(),
});

export const sendMessageSchema = z.object({
  content: z.string().trim().min(1).max(4000),
  stream: z.boolean().optional().default(true),
});
