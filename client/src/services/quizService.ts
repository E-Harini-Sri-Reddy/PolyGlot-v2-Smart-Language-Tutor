import { apiFetch } from "./api";
import type { SupportedLanguage } from "../constants/languages";

export type QuizQuestionView = {
  type: string;
  prompt: string;
  options?: string[];
};

export type GeneratedQuiz = {
  id: string;
  language: string;
  topic: string;
  total: number;
  questions: QuizQuestionView[];
};

export async function generateQuiz(language: SupportedLanguage, count = 5) {
  return apiFetch<{ success: boolean; quiz: GeneratedQuiz }>("/api/quizzes/generate", {
    method: "POST",
    body: JSON.stringify({ language, count }),
  });
}

export async function submitQuiz(quizId: string, answers: string[]) {
  return apiFetch<{
    success: boolean;
    percent: number;
    results: Array<{
      prompt: string;
      expected: string;
      userAnswer: string;
      correct: boolean;
      explanation?: string;
      type: string;
    }>;
  }>(`/api/quizzes/${quizId}/submit`, {
    method: "POST",
    body: JSON.stringify({ answers }),
  });
}

export async function listQuizzes() {
  return apiFetch<{
    success: boolean;
    quizzes: Array<{
      _id: string;
      topic: string;
      language: string;
      score: number;
      total: number;
      status: string;
      completedAt?: string;
    }>;
  }>("/api/quizzes");
}

export async function retakeQuiz(quizId: string) {
  return apiFetch<{ success: boolean; quiz: GeneratedQuiz }>(
    `/api/quizzes/${quizId}/retake`,
    { method: "POST" },
  );
}
