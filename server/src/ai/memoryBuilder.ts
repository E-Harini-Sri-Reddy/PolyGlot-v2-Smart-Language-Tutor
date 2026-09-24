import { conversationSummaryRepository } from "../repositories/conversationSummaryRepository.js";
import { dictionaryService } from "../services/dictionaryService.js";
import { learningDnaService } from "../services/learningDnaService.js";
import { userSettingsRepository } from "../repositories/userSettingsRepository.js";
import type { SupportedLanguage } from "../constants/languages.js";

export type LearnerMemoryContext = {
  memoryBlock: string;
  recallHint: string | null;
  profileSummary: {
    estimatedCEFR: string;
    strengths: string[];
    weaknesses: string[];
    recentVocabulary: string[];
    conversationConfidence: number;
  };
};

export const memoryBuilder = {
  async buildForUser(
    userId: string,
    language: SupportedLanguage,
  ): Promise<LearnerMemoryContext> {
    const [profile, settings, summaries, activeVocab] = await Promise.all([
      learningDnaService.getOrCreate(userId),
      userSettingsRepository.findByUserId(userId),
      conversationSummaryRepository.listRecentForUser(userId, 4, language),
      dictionaryService.getActiveVocabulary(userId, language, 8),
    ]);

    const summaryText =
      summaries.length === 0
        ? `No previous ${language} conversation summaries yet.`
        : summaries
            .map(
              (item, index) =>
                `${index + 1}. ${item.summary}${
                  item.importantVocabulary?.length
                    ? ` (vocab: ${item.importantVocabulary.slice(0, 5).join(", ")})`
                    : ""
                }`,
            )
            .join("\n");

    const languageVocab = activeVocab
      .map((entry) => `${entry.word} (${entry.meaning}, mastery ${entry.masteryScore})`)
      .join("; ");

    const recentFromDict = activeVocab
      .slice(0, 10)
      .map((entry) => entry.word)
      .join(", ");

    const mistakes = profile.commonMistakes
      .slice(0, 5)
      .map((m) => `${m.topic} x${m.count}`)
      .join("; ");

    const memoryBlock = `
LEARNING DNA (internal context for ${language} only — do not recite to the learner):
- Estimated CEFR: ${profile.estimatedCEFR}
- Confidence: ${profile.conversationConfidence}/100
- Vocabulary score: ${profile.vocabularyScore}/100
- Grammar score: ${profile.grammarScore}/100
- Strengths: ${profile.strengths.join(", ") || "still discovering"}
- Weaknesses: ${profile.weaknesses.join(", ") || "still discovering"}
- Common mistakes: ${mistakes || "none recorded yet"}
- Favorite topics: ${(settings?.preferredTopics || profile.favoriteTopics).join(", ") || "unspecified"}
- Recent ${language} vocabulary: ${recentFromDict || "none yet"}
- Words needing review: ${languageVocab || "none yet"}

RECENT ${language.toUpperCase()} CONVERSATION SUMMARIES (internal — do not mention unless the learner brings them up):
${summaryText}

MEMORY BEHAVIOR:
- Keep prior practice INTERNAL. Do not open with "Previously..." or summarize old sessions unprompted.
- Only mention prior practice if the learner explicitly asks about it or clearly continues the same topic.
- Prefer reinforcing low-mastery ${language} vocabulary in conversation.
- Focus gentle practice on weak grammar areas.
- Adapt difficulty gradually using confidence and CEFR.
- Ignore memories from other languages; this session is ${language} only.
`.trim();

    return {
      memoryBlock,
      recallHint: null,
      profileSummary: {
        estimatedCEFR: profile.estimatedCEFR,
        strengths: profile.strengths,
        weaknesses: profile.weaknesses,
        recentVocabulary: activeVocab.slice(0, 10).map((entry) => entry.word),
        conversationConfidence: profile.conversationConfidence,
      },
    };
  },
};
