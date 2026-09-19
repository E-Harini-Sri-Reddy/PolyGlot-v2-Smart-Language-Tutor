import { apiFetch } from "./api";
import type { SupportedLanguage, ProficiencyLevel } from "../constants/languages";

export type DictionaryEntry = {
  _id: string;
  word: string;
  language: string;
  meaning: string;
  pronunciation?: string;
  exampleSentence?: string;
  userExample?: string;
  category?: string;
  difficulty?: string;
  masteryScore: number;
  timesReviewed: number;
  lastReviewed?: string | null;
  nextReview?: string | null;
  favorite: boolean;
  notes?: string;
  source?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type LearningProfile = {
  id: string;
  estimatedCEFR: string;
  vocabularyScore: number;
  grammarScore: number;
  conversationConfidence: number;
  readingScore: number;
  strengths: string[];
  weaknesses: string[];
  commonMistakes: Array<{ topic: string; count: number }>;
  favoriteTopics: string[];
  recentVocabulary: string[];
  masteredTopics: string[];
  learningSpeed: string;
  totalConversations: number;
  totalMessages: number;
  updatedAt?: string;
};

export async function listDictionary(params: {
  language?: string;
  favorite?: boolean;
  needsReview?: boolean;
  search?: string;
} = {}) {
  const query = new URLSearchParams();
  if (params.language) query.set("language", params.language);
  if (params.favorite) query.set("favorite", "true");
  if (params.needsReview) query.set("needsReview", "true");
  if (params.search) query.set("search", params.search);
  const suffix = query.toString() ? `?${query}` : "";
  return apiFetch<{ success: boolean; entries: DictionaryEntry[] }>(
    `/api/dictionary${suffix}`,
  );
}

export async function addDictionaryWord(input: {
  word: string;
  language: SupportedLanguage;
  meaning: string;
  pronunciation?: string;
  exampleSentence?: string;
  category?: string;
  difficulty?: ProficiencyLevel;
  favorite?: boolean;
}) {
  return apiFetch<{ success: boolean; created: boolean; entry: DictionaryEntry }>(
    "/api/dictionary",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function saveWordFromContext(input: {
  word: string;
  language: SupportedLanguage;
  context: string;
  knownMeaning?: string;
  pronunciation?: string;
}) {
  return apiFetch<{ success: boolean; created: boolean; entry: DictionaryEntry }>(
    "/api/dictionary/from-context",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function updateDictionaryWord(
  id: string,
  updates: Partial<{
    meaning: string;
    pronunciation: string;
    exampleSentence: string;
    favorite: boolean;
    notes: string;
    masteryScore: number;
  }>,
) {
  return apiFetch<{ success: boolean; entry: DictionaryEntry }>(
    `/api/dictionary/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(updates),
    },
  );
}

export async function reviewDictionaryWord(id: string, remembered: boolean) {
  return apiFetch<{ success: boolean; entry: DictionaryEntry }>(
    `/api/dictionary/${id}/review`,
    {
      method: "POST",
      body: JSON.stringify({ remembered }),
    },
  );
}

export async function deleteDictionaryWord(id: string) {
  return apiFetch<{ success: boolean }>(`/api/dictionary/${id}`, {
    method: "DELETE",
  });
}

export async function getLearningProfile() {
  return apiFetch<{ success: boolean; profile: LearningProfile }>(
    "/api/learning/profile",
  );
}

export async function getProgressDashboard() {
  return apiFetch<{
    success: boolean;
    profile: LearningProfile;
    skills: Array<{
      skill: string;
      score: number;
      history: Array<{ date: string; score: number }>;
    }>;
    stats: {
      wordsLearned: number;
      wordsMastered: number;
      wordsNeedingReview: number;
      conversations: number;
      quizzesTaken: number;
      averageQuizScore: number | null;
      scenariosCompleted: number;
      dailyGoalMinutes?: number;
    };
    weakestSkill: { skill: string; score: number } | null;
    strongestSkill: { skill: string; score: number } | null;
    recommendedPractice: string;
    recommendedScenario?: string;
    recentConversations?: Array<{
      _id: string;
      title: string;
      language: string;
      level: string;
    }>;
    recentVocabulary?: Array<{
      _id: string;
      word: string;
      masteryScore: number;
    }>;
  }>("/api/learning/progress");
}
