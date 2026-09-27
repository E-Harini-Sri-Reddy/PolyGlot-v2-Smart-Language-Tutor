import mongoose from "mongoose";
import { dictionaryRepository } from "../repositories/dictionaryRepository.js";
import { AppError } from "../utils/errors.js";
import {
  NON_LATIN_LANGUAGES,
  type ProficiencyLevel,
  type SupportedLanguage,
} from "../constants/languages.js";
import { aiClient } from "../ai/client.js";
import { env } from "../config/env.js";

function daysFromMastery(masteryScore: number) {
  if (masteryScore >= 80) return 14;
  if (masteryScore >= 60) return 7;
  if (masteryScore >= 40) return 3;
  return 1;
}

/** Keep casing for CJK; lowercase Latin headwords only. */
function normalizeWord(word: string, language: SupportedLanguage) {
  const trimmed = word.trim().replace(/\|/g, "");
  if (NON_LATIN_LANGUAGES.includes(language)) {
    return trimmed;
  }
  return trimmed.toLowerCase();
}

export function cleanPipeText(text: string): string {
  if (!text.includes("|")) return text.trim();
  const parts = text
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
  const hasNative = parts.some((part) =>
    /[\u3040-\u9fff\uac00-\ud7af\u0600-\u06ff\u0900-\u097f]/.test(part),
  );
  return (hasNative ? parts.join("") : parts.join(" ")).trim();
}

function cleanContext(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => cleanPipeText(line))
    .filter(Boolean)
    .join("\n");
}

function extractExampleSentence(context: string, word: string): string {
  const lines = cleanContext(context)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const containing = lines.find(
    (line) =>
      line.includes(word) &&
      /[\u3040-\u9fff\uac00-\ud7af\u0600-\u06ff\u0900-\u097f]/.test(line),
  );
  if (containing) return containing.slice(0, 400);

  const any = lines.find((line) => line.includes(word));
  return (any || "").slice(0, 400);
}

async function lookupMeaningFromContext(input: {
  word: string;
  language: SupportedLanguage;
  context: string;
  hintMeaning?: string;
  hintPronunciation?: string;
}) {
  const completion = await aiClient.chat.completions.create({
    model: env.AI_MODEL,
    temperature: 0,
    max_tokens: 160,
    messages: [
      {
        role: "system",
        content: `You create dictionary entries for language learners.
Return ONLY valid JSON:
{"meaning":"short English gloss for THIS word only","pronunciation":"romanization/reading for THIS word only"}

Rules:
- meaning and pronunciation MUST belong to the exact given word/phrase — not neighboring words in the context.
- For Japanese: pronunciation is Hepburn romaji for that exact item (国 → "kuni", not "ku").
- For Chinese: pinyin with tones for that exact item.
- For Korean: Revised Romanization for that exact item.
- For Arabic/Hindi: clean Latin reading for that exact item.
- Ignore unrelated lines in the context (do not copy a different phrase's reading).
- If the item is a full sentence/phrase, meaning is the English translation of that whole phrase; pronunciation is the full romanization of that phrase.`,
      },
      {
        role: "user",
        content: `Language: ${input.language}
Word/phrase to define: ${input.word}
${input.hintMeaning ? `Hint meaning (verify/correct): ${input.hintMeaning}` : ""}
${input.hintPronunciation ? `Hint pronunciation (verify/correct): ${input.hintPronunciation}` : ""}
Context (may include other words — ignore mismatches):
${input.context.slice(0, 1200)}`,
      },
    ],
  });

  let raw = completion.choices?.[0]?.message?.content ?? "";
  if (Array.isArray(raw)) {
    raw = raw.map((part) => ("text" in part ? String(part.text) : "")).join("");
  }

  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      const parsed = JSON.parse(raw.slice(start, end + 1)) as {
        meaning?: string;
        pronunciation?: string;
      };
      const meaning = String(parsed.meaning || "").trim();
      const pronunciation = String(parsed.pronunciation || "").trim();
      if (meaning) {
        return { meaning, pronunciation };
      }
    }
  } catch {
    // fall through
  }

  return {
    meaning: input.hintMeaning?.trim() || `Meaning of “${input.word}”`,
    pronunciation: input.hintPronunciation?.trim() || "",
  };
}

function sanitizeEntryFields<T extends {
  word?: string;
  meaning?: string;
  pronunciation?: string;
  exampleSentence?: string;
}>(entry: T): T {
  return {
    ...entry,
    word: entry.word ? cleanPipeText(entry.word) : entry.word,
    meaning: entry.meaning ? cleanPipeText(entry.meaning) : entry.meaning,
    pronunciation: entry.pronunciation
      ? cleanPipeText(entry.pronunciation)
      : entry.pronunciation,
    exampleSentence: entry.exampleSentence
      ? cleanPipeText(entry.exampleSentence)
      : entry.exampleSentence,
  };
}

export const dictionaryService = {
  async list(
    userId: string,
    filters: {
      language?: string;
      favorite?: boolean;
      needsReview?: boolean;
      search?: string;
    } = {},
  ) {
    const entries = await dictionaryRepository.listForUser(userId, filters);
    // Clean legacy pipe-separated junk for display; persist fixes quietly
    const cleaned = [];
    for (const entry of entries) {
      const nextExample = entry.exampleSentence
        ? cleanPipeText(entry.exampleSentence)
        : entry.exampleSentence;
      const nextWord = cleanPipeText(entry.word);
      const nextPron = entry.pronunciation
        ? cleanPipeText(entry.pronunciation)
        : entry.pronunciation;
      if (
        nextExample !== entry.exampleSentence ||
        nextWord !== entry.word ||
        nextPron !== entry.pronunciation
      ) {
        entry.exampleSentence = nextExample || "";
        entry.word = nextWord;
        entry.pronunciation = nextPron || "";
        await dictionaryRepository.save(entry).catch(() => undefined);
      }
      cleaned.push(entry);
    }
    return cleaned;
  },

  async addWord(
    userId: string,
    input: {
      word: string;
      language: SupportedLanguage;
      meaning: string;
      pronunciation?: string;
      exampleSentence?: string;
      userExample?: string;
      category?: string;
      difficulty?: ProficiencyLevel;
      notes?: string;
      source?: "help" | "manual" | "correction" | "summary";
      favorite?: boolean;
    },
  ) {
    const word = normalizeWord(input.word, input.language);
    const meaning = cleanPipeText(input.meaning);
    if (!word || !meaning) {
      throw new AppError(400, "INVALID_WORD", "Word and meaning are required.");
    }

    const existing = await dictionaryRepository.findByUserWord(
      userId,
      input.language,
      word,
    );

    const pronunciation = input.pronunciation
      ? cleanPipeText(input.pronunciation)
      : "";
    const exampleSentence = input.exampleSentence
      ? cleanPipeText(input.exampleSentence)
      : "";

    if (existing) {
      if (meaning) existing.meaning = meaning;
      if (pronunciation) existing.pronunciation = pronunciation;
      if (exampleSentence) existing.exampleSentence = exampleSentence;
      if (input.userExample) existing.userExample = input.userExample;
      if (input.category) existing.category = input.category;
      if (input.notes) existing.notes = input.notes;
      if (typeof input.favorite === "boolean") existing.favorite = input.favorite;
      await dictionaryRepository.save(existing);
      return { entry: existing, created: false };
    }

    const entry = await dictionaryRepository.create({
      userId: new mongoose.Types.ObjectId(userId),
      word,
      language: input.language,
      meaning,
      pronunciation: pronunciation || "",
      exampleSentence: exampleSentence || "",
      userExample: input.userExample || "",
      category: input.category || "General",
      difficulty: input.difficulty || "Beginner",
      source: input.source || "manual",
      favorite: input.favorite || false,
      masteryScore: 20,
      nextReview: new Date(),
    });

    return { entry, created: true };
  },

  async saveFromContext(
    userId: string,
    input: {
      word: string;
      language: SupportedLanguage;
      context: string;
      knownMeaning?: string;
      pronunciation?: string;
    },
  ) {
    const cleaned = cleanPipeText(input.word);
    if (!cleaned) {
      throw new AppError(400, "INVALID_WORD", "Word is required.");
    }

    const context = cleanContext(input.context || cleaned);

    // Always verify with AI so neighboring romaji/meanings aren't attached by mistake
    const lookedUp = await lookupMeaningFromContext({
      word: cleaned,
      language: input.language,
      context,
      hintMeaning: input.knownMeaning,
      hintPronunciation: input.pronunciation,
    });

    return this.addWord(userId, {
      word: cleaned,
      language: input.language,
      meaning: lookedUp.meaning,
      pronunciation: lookedUp.pronunciation || undefined,
      exampleSentence: extractExampleSentence(context, cleaned),
      source: "manual",
      category: "From conversation",
    });
  },

  async updateEntry(
    userId: string,
    entryId: string,
    updates: Partial<{
      meaning: string;
      pronunciation: string;
      exampleSentence: string;
      userExample: string;
      category: string;
      notes: string;
      favorite: boolean;
      masteryScore: number;
    }>,
  ) {
    const entry = await dictionaryRepository.findByIdForUser(entryId, userId);
    if (!entry) {
      throw new AppError(404, "WORD_NOT_FOUND", "Dictionary entry not found.");
    }

    const sanitized = sanitizeEntryFields(updates);
    if (sanitized.meaning !== undefined) entry.meaning = sanitized.meaning;
    if (sanitized.pronunciation !== undefined) {
      entry.pronunciation = sanitized.pronunciation;
    }
    if (sanitized.exampleSentence !== undefined) {
      entry.exampleSentence = sanitized.exampleSentence;
    }
    if (updates.userExample !== undefined) entry.userExample = updates.userExample;
    if (updates.category !== undefined) entry.category = updates.category;
    if (updates.notes !== undefined) entry.notes = updates.notes;
    if (typeof updates.favorite === "boolean") entry.favorite = updates.favorite;
    if (typeof updates.masteryScore === "number") {
      entry.masteryScore = Math.max(0, Math.min(100, updates.masteryScore));
    }

    await dictionaryRepository.save(entry);
    return entry;
  },

  async markReviewed(userId: string, entryId: string, remembered: boolean) {
    const entry = await dictionaryRepository.findByIdForUser(entryId, userId);
    if (!entry) {
      throw new AppError(404, "WORD_NOT_FOUND", "Dictionary entry not found.");
    }

    entry.timesReviewed += 1;
    entry.lastReviewed = new Date();
    entry.masteryScore = Math.max(
      0,
      Math.min(100, entry.masteryScore + (remembered ? 12 : -8)),
    );
    const days = daysFromMastery(entry.masteryScore);
    entry.nextReview = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    await dictionaryRepository.save(entry);
    return entry;
  },

  async remove(userId: string, entryId: string) {
    const deleted = await dictionaryRepository.deleteForUser(entryId, userId);
    if (!deleted) {
      throw new AppError(404, "WORD_NOT_FOUND", "Dictionary entry not found.");
    }
    return { success: true };
  },

  async getActiveVocabulary(userId: string, language: SupportedLanguage, limit = 8) {
    return dictionaryRepository.listLowMastery(userId, language, limit);
  },

  parseHelpVocabulary(helpReply: string) {
    const lines = helpReply.split("\n");
    const entries: Array<{
      word: string;
      pronunciation: string;
      meaning: string;
    }> = [];

    for (const line of lines) {
      const cleaned = line.replace(/^[-*]\s*/, "").trim();
      const match = cleaned.match(
        /^(.+?)\s*(?:→|->|—|-)\s*(.+?)\s*(?:→|->|—|-)\s*(.+)$/,
      );
      if (!match) continue;
      const word = cleanPipeText(match[1]!);
      const pronunciation = cleanPipeText(match[2]!);
      const meaning = cleanPipeText(match[3]!);
      if (word && meaning && word.length < 40) {
        entries.push({ word, pronunciation, meaning });
      }
    }

    return entries.slice(0, 8);
  },

  async saveHelpVocabulary(
    userId: string,
    language: SupportedLanguage,
    helpReply: string,
    difficulty?: ProficiencyLevel,
  ) {
    const parsed = this.parseHelpVocabulary(helpReply);
    const saved = [];
    for (const item of parsed) {
      const result = await this.addWord(userId, {
        word: item.word,
        language,
        meaning: item.meaning,
        pronunciation: item.pronunciation,
        difficulty,
        source: "help",
        category: "From conversation",
      });
      saved.push(result.entry);
    }
    return saved;
  },
};
