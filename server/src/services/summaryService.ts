import { aiClient } from "../ai/client.js";
import { env } from "../config/env.js";
import { conversationSummaryRepository } from "../repositories/conversationSummaryRepository.js";
import { messageRepository } from "../repositories/messageRepository.js";
import { conversationRepository } from "../repositories/conversationRepository.js";
import { learningDnaService } from "./learningDnaService.js";
import mongoose from "mongoose";

type SummaryPayload = {
  summary: string;
  importantVocabulary: string[];
  grammarFocus: string[];
  strengthsObserved: string[];
  weaknessesObserved: string[];
};

function safeParseSummary(raw: string): SummaryPayload {
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      const parsed = JSON.parse(raw.slice(start, end + 1)) as Partial<SummaryPayload>;
      return {
        summary: String(parsed.summary || raw).slice(0, 800),
        importantVocabulary: Array.isArray(parsed.importantVocabulary)
          ? parsed.importantVocabulary.map(String).slice(0, 12)
          : [],
        grammarFocus: Array.isArray(parsed.grammarFocus)
          ? parsed.grammarFocus.map(String).slice(0, 8)
          : [],
        strengthsObserved: Array.isArray(parsed.strengthsObserved)
          ? parsed.strengthsObserved.map(String).slice(0, 6)
          : [],
        weaknessesObserved: Array.isArray(parsed.weaknessesObserved)
          ? parsed.weaknessesObserved.map(String).slice(0, 6)
          : [],
      };
    }
  } catch {
    // fall through
  }

  return {
    summary: raw.slice(0, 800),
    importantVocabulary: [],
    grammarFocus: [],
    strengthsObserved: [],
    weaknessesObserved: [],
  };
}

export const summaryService = {
  async maybeSummarizeConversation(input: {
    userId: string;
    conversationId: string;
    force?: boolean;
  }) {
    const conversation = await conversationRepository.findByIdForUser(
      input.conversationId,
      input.userId,
    );
    if (!conversation) return null;

    const existingCount = await conversationSummaryRepository.countForConversation(
      input.conversationId,
    );
    const messageCount = conversation.messageCount || 0;

    // Trigger every ~25 messages, or when forced (conversation end)
    const shouldRun =
      input.force ||
      (messageCount >= 10 && Math.floor(messageCount / 25) > existingCount);

    if (!shouldRun) return null;

    const messages = await messageRepository.listByConversation(input.conversationId, 60);
    if (messages.length < 4) return null;

    const transcript = messages
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n")
      .slice(0, 6000);

    const completion = await aiClient.chat.completions.create({
      model: env.AI_MODEL,
      temperature: 0.2,
      max_tokens: 500,
      messages: [
        {
          role: "system",
          content: `You summarize language-learning conversations for long-term tutor memory.
Return ONLY valid JSON:
{
  "summary": "2-4 sentence summary",
  "importantVocabulary": ["word1"],
  "grammarFocus": ["topic"],
  "strengthsObserved": ["strength"],
  "weaknessesObserved": ["weakness"]
}`,
        },
        {
          role: "user",
          content: `Language: ${conversation.language}\nLevel: ${conversation.level}\nScenario: ${conversation.scenarioText || "free conversation"}\n\nTranscript:\n${transcript}`,
        },
      ],
    });

    let raw = completion.choices?.[0]?.message?.content ?? "";
    if (Array.isArray(raw)) {
      raw = raw.map((part) => ("text" in part ? String(part.text) : "")).join("");
    }

    const parsed = safeParseSummary(raw || "Conversation practice completed.");

    const saved = await conversationSummaryRepository.create({
      conversationId: conversation._id,
      userId: new mongoose.Types.ObjectId(input.userId),
      language: conversation.language,
      summary: parsed.summary,
      importantVocabulary: parsed.importantVocabulary,
      grammarFocus: parsed.grammarFocus,
      strengthsObserved: parsed.strengthsObserved,
      weaknessesObserved: parsed.weaknessesObserved,
      messageWindowStart: existingCount * 25,
      messageWindowEnd: messageCount,
    });

    await learningDnaService.applySummaryInsights({
      userId: input.userId,
      vocabulary: parsed.importantVocabulary,
      grammarFocus: parsed.grammarFocus,
      strengths: parsed.strengthsObserved,
      weaknesses: parsed.weaknessesObserved,
    });

    // Do NOT write placeholder dictionary meanings — that breaks quizzes.
    // Vocabulary list stays in Learning DNA / summaries until the learner saves real meanings.

    return saved;
  },

  async endConversation(userId: string, conversationId: string) {
    const conversation = await conversationRepository.findByIdForUser(
      conversationId,
      userId,
    );
    if (!conversation) return null;

    conversation.status = "completed";
    conversation.endedAt = new Date();
    if (conversation.startedAt) {
      conversation.durationSeconds = Math.max(
        0,
        Math.floor((Date.now() - conversation.startedAt.getTime()) / 1000),
      );
    }
    await conversation.save();

    const summary = await this.maybeSummarizeConversation({
      userId,
      conversationId,
      force: true,
    });

    return { conversation, summary };
  },
};
