import { apiFetch } from "./api";
import type { ProficiencyLevel, SupportedLanguage } from "../constants/languages";

export type Scenario = {
  _id: string;
  title: string;
  category: string;
  difficulty: string;
  description?: string;
  learningGoal?: string;
  grammarFocus?: string[];
  vocabularyTags?: string[];
  conversationFlow?: string[];
  estimatedMinutes?: number;
  icon?: string;
  isPreset?: boolean;
};

export async function listScenarios(params: {
  difficulty?: string;
  category?: string;
} = {}) {
  const query = new URLSearchParams();
  if (params.difficulty) query.set("difficulty", params.difficulty);
  if (params.category) query.set("category", params.category);
  const suffix = query.toString() ? `?${query}` : "";
  return apiFetch<{ success: boolean; scenarios: Scenario[] }>(
    `/api/scenarios${suffix}`,
  );
}

export async function createCustomScenario(input: {
  prompt: string;
  language: SupportedLanguage;
  level: ProficiencyLevel;
}) {
  return apiFetch<{ success: boolean; scenario: Scenario }>("/api/scenarios/custom", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
