import mongoose from "mongoose";
import {
  NON_LATIN_LANGUAGES,
  type SupportedLanguage,
} from "../constants/languages.js";
import { dictionaryRepository } from "../repositories/dictionaryRepository.js";
import { learningDnaService } from "./learningDnaService.js";
import { quizRepository } from "../repositories/quizRepository.js";
import { progressService } from "./progressService.js";
import { AppError } from "../utils/errors.js";
import type { QuizQuestion } from "../models/QuizHistory.js";
import { aiClient } from "../ai/client.js";
import { env } from "../config/env.js";
import { cleanPipeText } from "./dictionaryService.js";

const PLACEHOLDER_MEANINGS = new Set([
  "review from conversation summary",
  "from summary",
]);

const FALLBACK_DISTRACTORS = [
  "small",
  "large",
  "coffee",
  "sugar",
  "please",
  "thank you",
  "water",
  "friend",
  "house",
  "today",
  "tomorrow",
  "hello",
  "goodbye",
  "food",
  "money",
];

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

function isUsableMeaning(meaning: string) {
  const normalized = meaning.trim().toLowerCase();
  if (!normalized || normalized.length < 2) return false;
  if (PLACEHOLDER_MEANINGS.has(normalized)) return false;
  if (normalized.startsWith("review from")) return false;
  return true;
}

function uniqueMeanings(
  words: Array<{ word: string; meaning: string }>,
  excludeWord: string,
  excludeMeaning: string,
) {
  const seen = new Set<string>([excludeMeaning.trim().toLowerCase()]);
  const result: string[] = [];
  for (const item of words) {
    if (item.word === excludeWord) continue;
    const meaning = item.meaning.trim();
    const key = meaning.toLowerCase();
    if (!isUsableMeaning(meaning) || seen.has(key)) continue;
    seen.add(key);
    result.push(meaning);
  }
  return result;
}

function uniqueWords(
  words: Array<{ word: string; meaning: string }>,
  excludeWord: string,
) {
  const seen = new Set<string>([excludeWord.trim().toLowerCase()]);
  const result: string[] = [];
  for (const item of words) {
    const key = item.word.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item.word);
  }
  return result;
}

function buildDistractors(
  words: Array<{ word: string; meaning: string }>,
  entry: { word: string; meaning: string },
) {
  const fromDict = shuffle(uniqueMeanings(words, entry.word, entry.meaning)).slice(0, 3);
  const fallbacks = shuffle(
    FALLBACK_DISTRACTORS.filter(
      (item) => item.toLowerCase() !== entry.meaning.trim().toLowerCase(),
    ),
  );
  const distractors = [...fromDict];
  for (const item of fallbacks) {
    if (distractors.length >= 3) break;
    if (!distractors.some((d) => d.toLowerCase() === item.toLowerCase())) {
      distractors.push(item);
    }
  }
  return distractors.slice(0, 3);
}

function isValidQuestion(question: QuizQuestion): boolean {
  if (!question.prompt?.trim() || !question.answer?.trim()) return false;
  if (question.type === "multiple_choice") {
    const options = (question.options || [])
      .map((item) => item.trim())
      .filter(Boolean);
    if (options.length < 2) return false;
    const unique = new Set(options.map((item) => item.toLowerCase()));
    if (unique.size < 2) return false;
    if (!options.some((item) => item.toLowerCase() === question.answer.trim().toLowerCase())) {
      return false;
    }
  }
  if (
    question.type === "translation" ||
    question.type === "fill_blank" ||
    question.type === "grammar_correction"
  ) {
    return question.answer.trim().length > 0;
  }
  return true;
}

function formatTerm(word: string, pronunciation?: string) {
  const cleaned = cleanPipeText(word);
  const reading = pronunciation ? cleanPipeText(pronunciation) : "";
  if (reading) return `“${cleaned}” (${reading})`;
  return `“${cleaned}”`;
}

function formatSentence(sentence: string, pronunciation?: string) {
  const cleaned = cleanPipeText(sentence);
  const reading = pronunciation ? cleanPipeText(pronunciation) : "";
  if (reading) return `“${cleaned}”\n(${reading})`;
  return `“${cleaned}”`;
}

function buildLocalQuestions(
  language: SupportedLanguage,
  words: Array<{
    word: string;
    meaning: string;
    pronunciation?: string;
    exampleSentence?: string;
  }>,
  count: number,
): QuizQuestion[] {
  const questions: QuizQuestion[] = [];
  const showReading = NON_LATIN_LANGUAGES.includes(language);

  for (const entry of words) {
    const term = showReading
      ? formatTerm(entry.word, entry.pronunciation)
      : `“${cleanPipeText(entry.word)}”`;
    const readingNote =
      showReading && entry.pronunciation
        ? ` Pronunciation: ${cleanPipeText(entry.pronunciation)}.`
        : "";

    const meaningDistractors = buildDistractors(words, entry);
    if (meaningDistractors.length >= 2) {
      const options = shuffle([entry.meaning, ...meaningDistractors]).slice(0, 4);
      questions.push({
        type: "multiple_choice",
        prompt: `What does the ${language} word ${term} mean?`,
        options,
        answer: entry.meaning,
        explanation: `${term} means “${entry.meaning}”.${readingNote}`,
        sourceWord: entry.word,
      });
    }

    const wordDistractors = shuffle(uniqueWords(words, entry.word)).slice(0, 3);
    if (wordDistractors.length >= 2) {
      const options = shuffle(
        [entry.word, ...wordDistractors].map((item) => {
          if (!showReading) return cleanPipeText(item);
          if (item === entry.word && entry.pronunciation) {
            return `${cleanPipeText(item)} (${cleanPipeText(entry.pronunciation)})`;
          }
          const match = words.find((w) => w.word === item);
          return match?.pronunciation
            ? `${cleanPipeText(item)} (${cleanPipeText(match.pronunciation)})`
            : cleanPipeText(item);
        }),
      ).slice(0, 4);
      // Answer must match an option exactly
      const answerOption =
        options.find((option) =>
          option.toLowerCase().startsWith(cleanPipeText(entry.word).toLowerCase()),
        ) || cleanPipeText(entry.word);
      questions.push({
        type: "multiple_choice",
        prompt: `Which ${language} word means “${entry.meaning}”?`,
        options,
        answer: answerOption,
        explanation: `“${entry.meaning}” is ${term} in ${language}.`,
        sourceWord: entry.word,
      });
    }

    questions.push({
      type: "translation",
      prompt: `Can you translate this to ${language}?\n\n“${entry.meaning}”`,
      options: [],
      answer: entry.word,
      explanation: `A natural ${language} translation is ${term}.`,
      sourceWord: entry.word,
    });

    const example = entry.exampleSentence
      ? cleanPipeText(entry.exampleSentence)
      : "";
    if (example.length > 2) {
      const blanked = example.replace(
        new RegExp(entry.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
        "_____",
      );
      if (blanked.includes("_____")) {
        questions.push({
          type: "fill_blank",
          prompt: `Fill in the blank with the correct ${language} word${
            showReading && entry.pronunciation
              ? ` (${cleanPipeText(entry.pronunciation)})`
              : ""
          }:\n\n${blanked}`,
          options: [],
          answer: entry.word,
          explanation: `The missing word is ${term} (${entry.meaning}).`,
          sourceWord: entry.word,
        });
      }

      questions.push({
        type: "translation",
        prompt: `Can you translate this ${language} sentence to English?\n\n${formatSentence(
          example,
          showReading ? entry.pronunciation : undefined,
        )}`,
        options: [],
        answer: example,
        explanation: `Translate the full sentence naturally into English.`,
        sourceWord: entry.word,
      });
    }
  }

  const valid = questions.filter(isValidQuestion);
  const multipleChoice = shuffle(valid.filter((q) => q.type === "multiple_choice"));
  const translations = shuffle(valid.filter((q) => q.type === "translation"));
  const others = shuffle(
    valid.filter((q) => q.type !== "multiple_choice" && q.type !== "translation"),
  );

  const mixed: QuizQuestion[] = [];
  while (mixed.length < count && (multipleChoice.length || translations.length || others.length)) {
    if (multipleChoice.length && mixed.length < count) {
      mixed.push(multipleChoice.shift()!);
    }
    if (translations.length && mixed.length < count) {
      mixed.push(translations.shift()!);
    }
    if (others.length && mixed.length < count) {
      mixed.push(others.shift()!);
    }
  }
  return mixed.slice(0, count);
}

function normalizeAnswer(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ");
}

function answersMatch(expected: string, actual: string) {
  const a = normalizeAnswer(expected);
  const b = normalizeAnswer(actual);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

function extractQuotedSource(prompt: string): string | null {
  const match = prompt.match(/[“"]([^”"]+)[”"]/);
  return match?.[1]?.trim() || null;
}

type SemanticGrade = {
  correct: boolean;
  feedback: string;
  modelTranslation: string;
};

async function gradeSemantically(input: {
  language: string;
  question: QuizQuestion;
  userAnswer: string;
}): Promise<SemanticGrade> {
  const source =
    extractQuotedSource(input.question.prompt) ||
    input.question.answer ||
    "";

  const completion = await aiClient.chat.completions.create({
    model: env.AI_MODEL,
    temperature: 0,
    max_tokens: 220,
    messages: [
      {
        role: "system",
        content: `You grade language-quiz translation answers like a bilingual dictionary / translator.
Accept answers that are semantically equivalent, even if wording differs from a reference gloss.
Accept synonyms, natural paraphrases, and full-sentence translations when a sentence was asked.
Reject answers that change the meaning, leave the item untranslated, or are in the wrong language.

Return ONLY valid JSON:
{"correct":true|false,"feedback":"one short sentence","modelTranslation":"a natural reference translation"}`,
      },
      {
        role: "user",
        content: `Target language being practiced: ${input.language}
Question type: ${input.question.type}
Question prompt:
${input.question.prompt}

Source text to translate (if any): ${source}
Dictionary/reference answer (may be incomplete — do NOT require an exact match): ${input.question.answer}
Learner answer: ${input.userAnswer}`,
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
      const parsed = JSON.parse(raw.slice(start, end + 1)) as Partial<SemanticGrade>;
      return {
        correct: Boolean(parsed.correct),
        feedback: String(parsed.feedback || "").trim(),
        modelTranslation: String(parsed.modelTranslation || "").trim(),
      };
    }
  } catch {
    // fall through
  }

  return {
    correct: false,
    feedback: "Could not verify this answer automatically.",
    modelTranslation: "",
  };
}

function needsSemanticGrading(question: QuizQuestion) {
  return (
    question.type === "translation" ||
    question.type === "fill_blank" ||
    question.type === "grammar_correction" ||
    question.type === "sentence_building"
  );
}

export const quizService = {
  async generate(userId: string, language: SupportedLanguage, count = 5) {
    await dictionaryRepository.deletePlaceholderMeanings(userId);

    const [entries] = await Promise.all([
      dictionaryRepository.listForUser(userId, { language, limit: 50 }),
      learningDnaService.getOrCreate(userId),
    ]);

    const quizable = entries
      .filter((entry) => isUsableMeaning(entry.meaning))
      .map((entry) => ({
        word: cleanPipeText(entry.word),
        meaning: entry.meaning.trim(),
        pronunciation: entry.pronunciation
          ? cleanPipeText(entry.pronunciation)
          : "",
        exampleSentence: entry.exampleSentence
          ? cleanPipeText(entry.exampleSentence)
          : "",
      }));

    const uniqueList: typeof quizable = [];
    const seenWords = new Set<string>();
    for (const item of quizable) {
      const key = item.word.toLowerCase();
      if (seenWords.has(key)) continue;
      seenWords.add(key);
      uniqueList.push(item);
    }

    if (uniqueList.length < 2) {
      throw new AppError(
        400,
        "NOT_ENOUGH_VOCAB",
        "Save at least 2 dictionary words with real meanings (use Help or Save word). Words imported from summaries alone are not enough.",
      );
    }

    const questions = buildLocalQuestions(
      language,
      uniqueList,
      Math.min(count, 8),
    );

    if (questions.length < 2) {
      throw new AppError(
        400,
        "QUIZ_BUILD_FAILED",
        "Could not build a valid quiz from your vocabulary. Add a few more words with clear English meanings.",
      );
    }

    const quiz = await quizRepository.create({
      userId: new mongoose.Types.ObjectId(userId),
      language,
      topic: `${language} vocabulary review`,
      questions,
      total: questions.length,
      status: "active",
    });

    return quiz;
  },

  async submit(userId: string, quizId: string, answers: string[]) {
    const quiz = await quizRepository.findByIdForUser(quizId, userId);
    if (!quiz) {
      throw new AppError(404, "QUIZ_NOT_FOUND", "Quiz not found.");
    }
    if (quiz.status === "completed") {
      throw new AppError(400, "QUIZ_COMPLETED", "This quiz was already submitted.");
    }

    const results = [];
    for (let index = 0; index < quiz.questions.length; index += 1) {
      const question = quiz.questions[index]!;
      const userAnswer = answers[index] ?? "";
      let correct = answersMatch(question.answer, userAnswer);
      let explanation = question.explanation || "";
      let expected = question.answer;

      if (!correct && needsSemanticGrading(question) && userAnswer.trim()) {
        try {
          const grade = await gradeSemantically({
            language: quiz.language,
            question,
            userAnswer,
          });
          correct = grade.correct;
          if (grade.modelTranslation) {
            expected = grade.modelTranslation;
          }
          if (grade.feedback) {
            explanation = correct
              ? `${grade.feedback}${
                  grade.modelTranslation
                    ? ` Reference: “${grade.modelTranslation}”.`
                    : ""
                }`
              : `${grade.feedback}${
                  grade.modelTranslation
                    ? ` A natural translation is “${grade.modelTranslation}”.`
                    : ""
                }`;
          } else if (correct && grade.modelTranslation) {
            explanation = `Accepted — your wording matches the meaning. Reference: “${grade.modelTranslation}”.`;
          }
        } catch (error) {
          console.error("Semantic quiz grading failed:", error);
        }
      } else if (correct && needsSemanticGrading(question)) {
        explanation =
          explanation ||
          `Correct. Accepted answer: “${question.answer}”.`;
      }

      // For sentence→English items stored with the source sentence as answer,
      // never show the raw source as "Expected" when the learner was right.
      if (
        correct &&
        question.type === "translation" &&
        question.prompt.includes("to English") &&
        expected === question.answer &&
        userAnswer.trim()
      ) {
        expected = userAnswer.trim();
        explanation =
          explanation ||
          "Accepted — your translation matches the meaning of the sentence.";
      }

      results.push({
        prompt: question.prompt,
        expected,
        userAnswer,
        correct,
        explanation,
        type: question.type,
        sourceWord: question.sourceWord,
      });
    }

    const score = results.filter((item) => item.correct).length;
    quiz.userAnswers = answers;
    quiz.score = score;
    quiz.total = quiz.questions.length;
    quiz.status = "completed";
    quiz.completedAt = new Date();
    await quiz.save();

    const percent = quiz.total ? Math.round((score / quiz.total) * 100) : 0;
    await progressService.recordQuizResult(userId, percent);

    for (const result of results) {
      if (!result.correct || !result.sourceWord) continue;
      const entry = await dictionaryRepository.findByUserWord(
        userId,
        quiz.language,
        result.sourceWord,
      );
      if (!entry) continue;
      entry.masteryScore = Math.min(100, entry.masteryScore + 10);
      entry.timesReviewed += 1;
      entry.lastReviewed = new Date();
      entry.nextReview = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      await dictionaryRepository.save(entry);
    }

    return { quiz, results, percent };
  },

  async list(userId: string) {
    return quizRepository.listForUser(userId);
  },

  async get(userId: string, quizId: string) {
    const quiz = await quizRepository.findByIdForUser(quizId, userId);
    if (!quiz) {
      throw new AppError(404, "QUIZ_NOT_FOUND", "Quiz not found.");
    }
    return quiz;
  },

  async retake(userId: string, quizId: string) {
    const original = await quizRepository.findByIdForUser(quizId, userId);
    if (!original) {
      throw new AppError(404, "QUIZ_NOT_FOUND", "Quiz not found.");
    }
    if (!original.questions?.length) {
      throw new AppError(400, "QUIZ_EMPTY", "This quiz has no questions to retake.");
    }

    const quiz = await quizRepository.create({
      userId: new mongoose.Types.ObjectId(userId),
      language: original.language,
      topic: `${original.topic} (retake)`,
      questions: original.questions.map((question) => ({
        type: question.type,
        prompt: question.prompt,
        options: question.options || [],
        answer: question.answer,
        explanation: question.explanation || "",
        sourceWord: question.sourceWord || "",
      })),
      total: original.questions.length,
      status: "active",
    });

    return quiz;
  },
};
