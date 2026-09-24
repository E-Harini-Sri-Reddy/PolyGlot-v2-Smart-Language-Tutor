import { z } from "zod";
import {
  PROFICIENCY_LEVELS,
  SUPPORTED_LANGUAGES,
} from "../constants/languages.js";

export const addDictionarySchema = z.object({
  word: z.string().trim().min(1).max(80),
  language: z.enum(SUPPORTED_LANGUAGES),
  meaning: z.string().trim().min(1).max(400),
  pronunciation: z.string().trim().max(120).optional(),
  exampleSentence: z.string().trim().max(400).optional(),
  userExample: z.string().trim().max(400).optional(),
  category: z.string().trim().max(80).optional(),
  difficulty: z.enum(PROFICIENCY_LEVELS).optional(),
  notes: z.string().trim().max(500).optional(),
  favorite: z.boolean().optional(),
});

export const saveFromContextSchema = z.object({
  word: z.string().trim().min(1).max(80),
  language: z.enum(SUPPORTED_LANGUAGES),
  context: z.string().trim().min(1).max(4000),
  knownMeaning: z.string().trim().min(1).max(400).optional(),
  pronunciation: z.string().trim().max(120).optional(),
});

export const updateDictionarySchema = z.object({
  meaning: z.string().trim().min(1).max(400).optional(),
  pronunciation: z.string().trim().max(120).optional(),
  exampleSentence: z.string().trim().max(400).optional(),
  userExample: z.string().trim().max(400).optional(),
  category: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(500).optional(),
  favorite: z.boolean().optional(),
  masteryScore: z.number().min(0).max(100).optional(),
});

export const reviewDictionarySchema = z.object({
  remembered: z.boolean(),
});
