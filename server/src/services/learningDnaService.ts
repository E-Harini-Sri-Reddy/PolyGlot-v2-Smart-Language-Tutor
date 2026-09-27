import type { TutorCorrection } from "../ai/contextBuilder.js";
import type { ProficiencyLevel } from "../constants/languages.js";
import { learningProfileRepository } from "../repositories/learningProfileRepository.js";

function uniquePush(list: string[], values: string[], max = 12) {
  const next = [...list];
  for (const value of values) {
    const cleaned = value.trim();
    if (!cleaned) continue;
    const exists = next.some((item) => item.toLowerCase() === cleaned.toLowerCase());
    if (!exists) next.unshift(cleaned);
  }
  return next.slice(0, max);
}

function inferMistakeTopic(correction: TutorCorrection): string {
  const text = `${correction.corrected} ${correction.explain} ${correction.why || ""}`.toLowerCase();
  if (text.includes("gender") || text.includes("el ") || text.includes("la ")) {
    return "gender agreement";
  }
  if (text.includes("past") || text.includes("went") || text.includes("tense")) {
    return "verb tense";
  }
  if (text.includes("article") || text.includes("a ") || text.includes("the ")) {
    return "articles";
  }
  if (text.includes("conjug") || text.includes("verb")) {
    return "verb conjugation";
  }
  if (text.includes("preposition")) {
    return "prepositions";
  }
  return "grammar accuracy";
}

function cefrFromLevel(level?: ProficiencyLevel) {
  switch (level) {
    case "Beginner":
      return "A1" as const;
    case "Intermediate":
      return "A2" as const;
    case "Advanced":
      return "B1" as const;
    default:
      return "A1" as const;
  }
}

export const learningDnaService = {
  async getOrCreate(userId: string) {
    const existing = await learningProfileRepository.findByUserId(userId);
    if (existing) return existing;
    return learningProfileRepository.createForUser(userId);
  },

  async getPublicProfile(userId: string) {
    const profile = await this.getOrCreate(userId);
    return {
      id: profile._id.toString(),
      estimatedCEFR: profile.estimatedCEFR,
      vocabularyScore: profile.vocabularyScore,
      grammarScore: profile.grammarScore,
      conversationConfidence: profile.conversationConfidence,
      readingScore: profile.readingScore,
      strengths: profile.strengths,
      weaknesses: profile.weaknesses,
      commonMistakes: profile.commonMistakes,
      favoriteTopics: profile.favoriteTopics,
      recentVocabulary: profile.recentVocabulary,
      masteredTopics: profile.masteredTopics,
      learningSpeed: profile.learningSpeed,
      totalConversations: profile.totalConversations,
      totalMessages: profile.totalMessages,
      updatedAt: profile.updatedAt,
    };
  },

  async recordConversationStart(userId: string, level?: ProficiencyLevel) {
    const profile = await this.getOrCreate(userId);
    profile.totalConversations += 1;
    if (profile.estimatedCEFR === "A1" && level) {
      profile.estimatedCEFR = cefrFromLevel(level);
    }
    await learningProfileRepository.save(profile);
    return profile;
  },

  async applyTurnUpdate(input: {
    userId: string;
    userMessageLength: number;
    correction: TutorCorrection | null;
    newWords?: string[];
    grammarTopics?: string[];
  }) {
    const profile = await this.getOrCreate(input.userId);
    profile.totalMessages += 2;

    // Confidence rises with longer learner turns, falls slightly after corrections.
    const lengthBonus = Math.min(8, Math.floor(input.userMessageLength / 20));
    profile.conversationConfidence = Math.max(
      5,
      Math.min(
        100,
        profile.conversationConfidence + lengthBonus - (input.correction ? 2 : -1),
      ),
    );

    if (input.correction) {
      const topic = inferMistakeTopic(input.correction);
      const existing = profile.commonMistakes.find(
        (item) => item.topic.toLowerCase() === topic.toLowerCase(),
      );
      if (existing) {
        existing.count += 1;
      } else {
        profile.commonMistakes.unshift({ topic, count: 1 });
      }
      profile.commonMistakes = profile.commonMistakes
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      profile.weaknesses = uniquePush(profile.weaknesses, [topic], 8);
      profile.grammarScore = Math.max(0, profile.grammarScore - 1);
    } else {
      profile.grammarScore = Math.min(100, profile.grammarScore + 1);
    }

    if (input.newWords?.length) {
      profile.recentVocabulary = uniquePush(
        profile.recentVocabulary,
        input.newWords,
        20,
      );
      profile.vocabularyScore = Math.min(
        100,
        profile.vocabularyScore + input.newWords.length,
      );
    }

    if (input.grammarTopics?.length) {
      profile.weaknesses = uniquePush(profile.weaknesses, input.grammarTopics, 8);
    }

    // Gentle CEFR progression only with strong evidence
    if (
      profile.conversationConfidence >= 75 &&
      profile.vocabularyScore >= 40 &&
      profile.grammarScore >= 40 &&
      profile.estimatedCEFR === "A1"
    ) {
      profile.estimatedCEFR = "A2";
    } else if (
      profile.conversationConfidence >= 85 &&
      profile.vocabularyScore >= 65 &&
      profile.grammarScore >= 60 &&
      profile.estimatedCEFR === "A2"
    ) {
      profile.estimatedCEFR = "B1";
    }

    await learningProfileRepository.save(profile);
    return profile;
  },

  async applySummaryInsights(input: {
    userId: string;
    vocabulary: string[];
    grammarFocus: string[];
    strengths: string[];
    weaknesses: string[];
  }) {
    const profile = await this.getOrCreate(input.userId);
    profile.recentVocabulary = uniquePush(
      profile.recentVocabulary,
      input.vocabulary,
      20,
    );
    profile.strengths = uniquePush(profile.strengths, input.strengths, 8);
    profile.weaknesses = uniquePush(profile.weaknesses, input.weaknesses, 8);
    for (const topic of input.grammarFocus) {
      const existing = profile.commonMistakes.find(
        (item) => item.topic.toLowerCase() === topic.toLowerCase(),
      );
      if (existing) existing.count += 1;
      else profile.commonMistakes.unshift({ topic, count: 1 });
    }
    profile.commonMistakes = profile.commonMistakes
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    await learningProfileRepository.save(profile);
    return profile;
  },
};
