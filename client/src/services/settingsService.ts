import { apiFetch } from "./api";
import type {
  ProficiencyLevel,
  SupportedLanguage,
  TutorPersonality,
} from "../constants/languages";

export type UserSettings = {
  name?: string;
  pronouns?: string;
  targetLanguage: SupportedLanguage;
  level: ProficiencyLevel;
  tutorPersonality: TutorPersonality;
  dailyGoalMinutes: number;
  learningGoal: string;
  preferredTopics: string[];
  theme?: string;
  notificationsEnabled?: boolean;
  showEnglishUnderReplies?: boolean;
};

export async function getSettings() {
  return apiFetch<{
    success: boolean;
    settings: UserSettings;
    onboardingCompleted: boolean;
  }>("/api/settings");
}

export async function updateSettings(updates: Partial<UserSettings>) {
  return apiFetch<{ success: boolean; settings: UserSettings }>("/api/settings", {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export async function completeOnboarding(input: {
  targetLanguage: SupportedLanguage;
  level: ProficiencyLevel;
  learningGoal: string;
  dailyGoalMinutes: number;
  tutorPersonality: TutorPersonality;
  preferredTopics: string[];
}) {
  return apiFetch<{
    success: boolean;
    user: {
      id: string;
      name: string;
      email: string;
      avatarUrl: string | null;
      onboardingCompleted: boolean;
    };
    settings: UserSettings;
  }>("/api/settings/onboarding", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getWeeklyInsights() {
  return apiFetch<{
    success: boolean;
    insights: {
      weekStart: string;
      wordsLearned: number;
      conversationMinutes: number;
      conversations: number;
      quizzesCompleted: number;
      improved: string;
      strongestArea: string;
      needsImprovement: string;
      estimatedCEFR: string;
      dailyGoalMinutes: number;
      grammarTopicsCovered: string[];
      encouragement: string;
    };
  }>("/api/learning/weekly-insights");
}
