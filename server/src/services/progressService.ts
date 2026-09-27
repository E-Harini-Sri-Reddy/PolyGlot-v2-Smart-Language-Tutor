import { learningDnaService } from "./learningDnaService.js";
import { skillProgressRepository } from "../repositories/skillProgressRepository.js";
import { dictionaryRepository } from "../repositories/dictionaryRepository.js";
import { conversationRepository } from "../repositories/conversationRepository.js";
import { quizRepository } from "../repositories/quizRepository.js";
import { scenarioHistoryRepository } from "../repositories/scenarioRepository.js";
import { conversationSummaryRepository } from "../repositories/conversationSummaryRepository.js";
import { userSettingsRepository } from "../repositories/userSettingsRepository.js";

function startOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - diff);
  return d;
}

export const progressService = {
  async syncFromLearningDna(userId: string) {
    const profile = await learningDnaService.getOrCreate(userId);
    await skillProgressRepository.ensureDefaults(userId);
    await Promise.all([
      skillProgressRepository.upsertScore(
        userId,
        "Vocabulary",
        profile.vocabularyScore,
      ),
      skillProgressRepository.upsertScore(userId, "Grammar", profile.grammarScore),
      skillProgressRepository.upsertScore(
        userId,
        "Conversation Confidence",
        profile.conversationConfidence,
      ),
      skillProgressRepository.upsertScore(
        userId,
        "Reading",
        Math.round((profile.vocabularyScore + profile.grammarScore) / 2),
      ),
    ]);
    return skillProgressRepository.listForUser(userId);
  },

  async recordQuizResult(userId: string, percent: number) {
    const skills = await skillProgressRepository.ensureDefaults(userId);
    const vocab = skills.find((item) => item.skill === "Vocabulary");
    const next = Math.round(((vocab?.score || 20) + percent) / 2);
    await skillProgressRepository.upsertScore(userId, "Vocabulary", next);
    await skillProgressRepository.upsertScore(
      userId,
      "Reading",
      Math.min(100, next + 5),
    );
  },

  async getDashboard(userId: string) {
    const [skills, profile, dictionary, conversations, quizzes, scenarioHistory, settings] =
      await Promise.all([
        this.syncFromLearningDna(userId),
        learningDnaService.getPublicProfile(userId),
        dictionaryRepository.listForUser(userId, { limit: 200 }),
        conversationRepository.listForUser(userId, 10),
        quizRepository.listForUser(userId, 10),
        scenarioHistoryRepository.listForUser(userId, 10),
        userSettingsRepository.findByUserId(userId),
      ]);

    const mastered = dictionary.filter((entry) => entry.masteryScore >= 80).length;
    const needsReview = dictionary.filter(
      (entry) => entry.nextReview && entry.nextReview <= new Date(),
    ).length;
    const completedQuizzes = quizzes.filter((quiz) => quiz.status === "completed");
    const avgQuiz =
      completedQuizzes.length === 0
        ? null
        : Math.round(
            completedQuizzes.reduce(
              (sum, quiz) => sum + (quiz.total ? (quiz.score / quiz.total) * 100 : 0),
              0,
            ) / completedQuizzes.length,
          );

    const weakestSkill = [...skills].sort((a, b) => a.score - b.score)[0];
    const strongestSkill = [...skills].sort((a, b) => b.score - a.score)[0];

    return {
      profile,
      skills,
      settings,
      stats: {
        wordsLearned: dictionary.length,
        wordsMastered: mastered,
        wordsNeedingReview: needsReview,
        conversations: conversations.length,
        quizzesTaken: completedQuizzes.length,
        averageQuizScore: avgQuiz,
        scenariosCompleted: scenarioHistory.length,
        dailyGoalMinutes: settings?.dailyGoalMinutes || 15,
      },
      weakestSkill: weakestSkill
        ? { skill: weakestSkill.skill, score: weakestSkill.score }
        : null,
      strongestSkill: strongestSkill
        ? { skill: strongestSkill.skill, score: strongestSkill.score }
        : null,
      recommendedPractice:
        profile.weaknesses[0] ||
        (needsReview > 0 ? "Review saved vocabulary" : "Start a scenario conversation"),
      recommendedScenario:
        profile.weaknesses[0]?.includes("gender")
          ? "Restaurant"
          : profile.favoriteTopics[0] || "Coffee Shop",
      recentConversations: conversations.slice(0, 5),
      recentQuizzes: completedQuizzes.slice(0, 5),
      recentVocabulary: dictionary.slice(0, 6),
    };
  },

  async getWeeklyInsights(userId: string) {
    const weekStart = startOfWeek();
    const [profile, dictionary, conversations, quizzes, summaries, settings] =
      await Promise.all([
        learningDnaService.getPublicProfile(userId),
        dictionaryRepository.listForUser(userId, { limit: 300 }),
        conversationRepository.listForUser(userId, 50),
        quizRepository.listForUser(userId, 50),
        conversationSummaryRepository.listRecentForUser(userId, 20),
        userSettingsRepository.findByUserId(userId),
      ]);

    const wordsThisWeek = dictionary.filter(
      (entry) => entry.createdAt && entry.createdAt >= weekStart,
    );
    const conversationsThisWeek = conversations.filter(
      (item) => item.createdAt && item.createdAt >= weekStart,
    );
    const quizzesThisWeek = quizzes.filter(
      (quiz) =>
        quiz.status === "completed" &&
        quiz.completedAt &&
        quiz.completedAt >= weekStart,
    );
    const minutes = conversationsThisWeek.reduce(
      (sum, item) => sum + (item.durationSeconds || 0),
      0,
    );
    const grammarTopics = [
      ...new Set(summaries.flatMap((item) => item.grammarFocus || [])),
    ].slice(0, 5);

    return {
      weekStart,
      wordsLearned: wordsThisWeek.length,
      conversationMinutes: Math.round(minutes / 60),
      conversations: conversationsThisWeek.length,
      quizzesCompleted: quizzesThisWeek.length,
      improved: profile.strengths[0] || grammarTopics[0] || "Conversation fluency",
      strongestArea: profile.strengths[0] || "Getting started",
      needsImprovement: profile.weaknesses[0] || "Keep practicing daily",
      estimatedCEFR: profile.estimatedCEFR,
      dailyGoalMinutes: settings?.dailyGoalMinutes || 15,
      grammarTopicsCovered: grammarTopics,
      encouragement:
        wordsThisWeek.length > 0 || conversationsThisWeek.length > 0
          ? "Nice consistency this week — Polly is proud of your progress."
          : "A short conversation today can start a great learning week.",
    };
  },
};
