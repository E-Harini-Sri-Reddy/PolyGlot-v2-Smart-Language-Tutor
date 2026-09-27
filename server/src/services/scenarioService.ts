import mongoose from "mongoose";
import { PRESET_SCENARIOS } from "../constants/presetScenarios.js";
import type { ProficiencyLevel, SupportedLanguage } from "../constants/languages.js";
import {
  scenarioHistoryRepository,
  scenarioRepository,
} from "../repositories/scenarioRepository.js";
import { aiClient } from "../ai/client.js";
import { env } from "../config/env.js";
import { AppError } from "../utils/errors.js";

export const scenarioService = {
  async ensurePresetsSeeded() {
    const count = await scenarioRepository.countPresets();
    if (count > 0) return count;
    await scenarioRepository.insertMany(
      PRESET_SCENARIOS.map((scenario) => ({ ...scenario, isPreset: true })),
    );
    return PRESET_SCENARIOS.length;
  },

  async listPresets(filters: { difficulty?: string; category?: string } = {}) {
    await this.ensurePresetsSeeded();
    return scenarioRepository.listPresets(filters);
  },

  async getById(id: string) {
    const scenario = await scenarioRepository.findById(id);
    if (!scenario) {
      throw new AppError(404, "SCENARIO_NOT_FOUND", "Scenario not found.");
    }
    return scenario;
  },

  async createCustom(input: {
    userId: string;
    prompt: string;
    language: SupportedLanguage;
    level: ProficiencyLevel;
  }) {
    const completion = await aiClient.chat.completions.create({
      model: env.AI_MODEL,
      temperature: 0.4,
      max_tokens: 500,
      messages: [
        {
          role: "system",
          content: `You design language-learning roleplay scenarios.
Return ONLY JSON:
{
  "title": "short title",
  "category": "Travel|Daily Life|Business|Social|Health|Custom",
  "learningGoal": "one sentence",
  "grammarFocus": ["topic"],
  "vocabularyTags": ["tag"],
  "conversationFlow": ["stage1","stage2"],
  "estimatedMinutes": 10,
  "promptTemplate": "roleplay instructions for the tutor character"
}`,
        },
        {
          role: "user",
          content: `Learner level: ${input.level}
Target language: ${input.language}
Learner request: ${input.prompt}`,
        },
      ],
    });

    let raw = completion.choices?.[0]?.message?.content ?? "";
    if (Array.isArray(raw)) {
      raw = raw.map((part) => ("text" in part ? String(part.text) : "")).join("");
    }

    let parsed: {
      title?: string;
      category?: string;
      learningGoal?: string;
      grammarFocus?: string[];
      vocabularyTags?: string[];
      conversationFlow?: string[];
      estimatedMinutes?: number;
      promptTemplate?: string;
    } = {};

    try {
      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");
      if (start >= 0 && end > start) {
        parsed = JSON.parse(raw.slice(start, end + 1)) as typeof parsed;
      }
    } catch {
      parsed = {};
    }

    const scenario = await scenarioRepository.create({
      title: parsed.title || input.prompt.slice(0, 60) || "Custom scenario",
      category: parsed.category || "Custom",
      difficulty: input.level,
      description: input.prompt,
      learningGoal: parsed.learningGoal || "Practice useful conversation",
      grammarFocus: parsed.grammarFocus || [],
      vocabularyTags: parsed.vocabularyTags || [],
      conversationFlow: parsed.conversationFlow || ["Opening", "Practice", "Closing"],
      estimatedMinutes: parsed.estimatedMinutes || 10,
      promptTemplate:
        parsed.promptTemplate ||
        `Roleplay this situation with the learner: ${input.prompt}`,
      isPreset: false,
      createdBy: new mongoose.Types.ObjectId(input.userId),
      icon: "✨",
    });

    return scenario;
  },

  buildScenarioText(scenario: {
    title: string;
    promptTemplate: string;
    learningGoal?: string;
    grammarFocus?: string[];
    vocabularyTags?: string[];
    conversationFlow?: string[];
  }) {
    return [
      `Scenario: ${scenario.title}`,
      scenario.promptTemplate,
      scenario.learningGoal ? `Learning goal: ${scenario.learningGoal}` : "",
      scenario.grammarFocus?.length
        ? `Grammar focus: ${scenario.grammarFocus.join(", ")}`
        : "",
      scenario.vocabularyTags?.length
        ? `Vocabulary focus: ${scenario.vocabularyTags.join(", ")}`
        : "",
      scenario.conversationFlow?.length
        ? `Suggested progression: ${scenario.conversationFlow.join(" → ")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");
  },

  async recordCompletion(input: {
    userId: string;
    scenarioId: string;
    conversationId?: string;
    difficulty: string;
    performanceScore?: number;
  }) {
    return scenarioHistoryRepository.create({
      userId: new mongoose.Types.ObjectId(input.userId),
      scenarioId: new mongoose.Types.ObjectId(input.scenarioId),
      conversationId: input.conversationId
        ? new mongoose.Types.ObjectId(input.conversationId)
        : null,
      difficulty: input.difficulty,
      performanceScore: input.performanceScore ?? 75,
    });
  },

  async listHistory(userId: string) {
    return scenarioHistoryRepository.listForUser(userId);
  },
};
