import type { Response } from "express";
import mongoose from "mongoose";
import { aiService } from "../ai/aiService.js";
import { memoryBuilder } from "../ai/memoryBuilder.js";
import type {
  ProficiencyLevel,
  SupportedLanguage,
  TutorPersonality,
} from "../constants/languages.js";
import { conversationRepository } from "../repositories/conversationRepository.js";
import { messageRepository } from "../repositories/messageRepository.js";
import { conversationSummaryRepository } from "../repositories/conversationSummaryRepository.js";
import { scenarioHistoryRepository } from "../repositories/scenarioRepository.js";
import { userRepository } from "../repositories/userRepository.js";
import { userSettingsRepository } from "../repositories/userSettingsRepository.js";
import { AppError } from "../utils/errors.js";
import { learningDnaService } from "./learningDnaService.js";
import { dictionaryService } from "./dictionaryService.js";
import { summaryService } from "./summaryService.js";
import type { TutorCorrection } from "../ai/contextBuilder.js";

function toObjectId(id: string) {
  return new mongoose.Types.ObjectId(id);
}

async function persistAssistantTurn(input: {
  userId: string;
  conversationId: string;
  conversation: {
    _id: mongoose.Types.ObjectId;
    language: string;
    level: string;
  };
  dialogue: string;
  correction: TutorCorrection | null;
  helpMode: boolean;
  userMessage: string;
}) {
  let savedWords: string[] = [];

  if (input.helpMode) {
    const entries = await dictionaryService.saveHelpVocabulary(
      input.userId,
      input.conversation.language as SupportedLanguage,
      input.dialogue,
      input.conversation.level as ProficiencyLevel,
    );
    savedWords = entries.map((entry) => entry.word);
  }

  const assistantMessage = await messageRepository.create({
    conversationId: input.conversation._id,
    userId: toObjectId(input.userId),
    role: "assistant",
    content: input.dialogue,
    language: input.conversation.language,
    metadata: {
      corrections: input.correction ? [input.correction] : [],
      newWords: savedWords,
      grammarTopics: input.correction ? ["grammar correction"] : [],
      helpMode: input.helpMode,
    },
  });

  await conversationRepository.incrementMessageCount(input.conversationId, 2);

  await learningDnaService.applyTurnUpdate({
    userId: input.userId,
    userMessageLength: input.userMessage.length,
    correction: input.correction,
    newWords: savedWords,
    grammarTopics: input.correction ? ["grammar correction"] : [],
  });

  // Fire-and-forget summarization checkpoints
  void summaryService
    .maybeSummarizeConversation({
      userId: input.userId,
      conversationId: input.conversationId,
    })
    .catch((error) => console.error("Summary generation failed:", error));

  return { assistantMessage, savedWords };
}

export const chatService = {
  async createConversation(
    userId: string,
    input: {
      language: SupportedLanguage;
      level: ProficiencyLevel;
      scenario?: string;
      scenarioId?: string;
      customScenario?: string;
      title?: string;
    },
  ) {
    const { scenarioService } = await import("./scenarioService.js");

    let scenarioId: mongoose.Types.ObjectId | null = null;
    let scenarioText = input.scenario?.trim() || "";
    let type: "scenario" | "free" | "custom" = scenarioText ? "custom" : "free";
    let title =
      input.title ||
      (scenarioText
        ? scenarioText.slice(0, 80)
        : `${input.language} practice with Polly`);

    if (input.scenarioId) {
      const preset = await scenarioService.getById(input.scenarioId);
      scenarioId = preset._id;
      scenarioText = scenarioService.buildScenarioText(preset);
      type = "scenario";
      title = preset.title;
    } else if (input.customScenario?.trim()) {
      const custom = await scenarioService.createCustom({
        userId,
        prompt: input.customScenario.trim(),
        language: input.language,
        level: input.level,
      });
      scenarioId = custom._id;
      scenarioText = scenarioService.buildScenarioText(custom);
      type = "custom";
      title = custom.title;
    }

    const conversation = await conversationRepository.create({
      userId: toObjectId(userId),
      language: input.language,
      level: input.level,
      type,
      scenarioId,
      scenarioText,
      title,
      status: "active",
    });

    await learningDnaService.recordConversationStart(userId, input.level);
    const memory = await memoryBuilder.buildForUser(userId, input.language);

    const intro = scenarioText
      ? `Scenario ready: ${title}\n\nPolly is in character — reply in ${input.language} to begin.`
      : `Hi! I'm Polly, your PolyGlot AI tutor. Let's practice ${input.language}. Say hello or tell me what you'd like to talk about.`;

    const message = await messageRepository.create({
      conversationId: conversation._id,
      userId: toObjectId(userId),
      role: "assistant",
      content: intro,
      language: input.language,
      metadata: {
        corrections: [],
        newWords: [],
        grammarTopics: [],
        helpMode: false,
      },
    });

    await conversationRepository.incrementMessageCount(conversation._id.toString(), 1);

    return { conversation, message, memory: memory.profileSummary };
  },

  async listConversations(userId: string) {
    return conversationRepository.listForUser(userId);
  },

  async getConversation(userId: string, conversationId: string) {
    const conversation = await conversationRepository.findByIdForUser(
      conversationId,
      userId,
    );
    if (!conversation) {
      throw new AppError(404, "CONVERSATION_NOT_FOUND", "Conversation not found.");
    }

    const messages = await messageRepository.listByConversation(conversationId);
    return { conversation, messages };
  },

  async endConversation(userId: string, conversationId: string) {
    const result = await summaryService.endConversation(userId, conversationId);
    if (!result) {
      throw new AppError(404, "CONVERSATION_NOT_FOUND", "Conversation not found.");
    }

    if (result.conversation.scenarioId) {
      const { scenarioService } = await import("./scenarioService.js");
      const profile = await learningDnaService.getOrCreate(userId);
      await scenarioService.recordCompletion({
        userId,
        scenarioId: result.conversation.scenarioId.toString(),
        conversationId,
        difficulty: result.conversation.level,
        performanceScore: profile.conversationConfidence,
      });
    }

    const { progressService } = await import("./progressService.js");
    await progressService.syncFromLearningDna(userId);

    return result;
  },

  async deleteConversation(userId: string, conversationId: string) {
    const conversation = await conversationRepository.findByIdForUser(
      conversationId,
      userId,
    );
    if (!conversation) {
      throw new AppError(404, "CONVERSATION_NOT_FOUND", "Conversation not found.");
    }

    // Scoped cleanup only for this chat. Dictionary words and Learning DNA stay.
    await Promise.all([
      messageRepository.deleteByConversation(conversationId),
      conversationSummaryRepository.deleteByConversation(conversationId),
      scenarioHistoryRepository.deleteByConversation(conversationId),
    ]);

    await conversationRepository.deleteForUser(conversationId, userId);

    return { deleted: true, conversationId };
  },

  async sendMessage(
    userId: string,
    conversationId: string,
    content: string,
    res?: Response,
  ) {
    const conversation = await conversationRepository.findByIdForUser(
      conversationId,
      userId,
    );
    if (!conversation) {
      throw new AppError(404, "CONVERSATION_NOT_FOUND", "Conversation not found.");
    }

    const user = await userRepository.findById(userId);
    const settings = await userSettingsRepository.findByUserId(userId);
    const memory = await memoryBuilder.buildForUser(
      userId,
      conversation.language as SupportedLanguage,
    );

    await messageRepository.create({
      conversationId: conversation._id,
      userId: toObjectId(userId),
      role: "user",
      content,
      language: conversation.language,
    });

    const historyDocs = await messageRepository.listRecent(conversationId, 25);
    const history = historyDocs
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    const helpMode = aiService.isHelpRequest(content);
    const replyInput = {
      language: conversation.language as SupportedLanguage,
      level: (conversation.level as ProficiencyLevel) || "Beginner",
      scenario: conversation.scenarioText || undefined,
      history,
      learnerName: user?.name,
      learnerPronouns: user?.pronouns || undefined,
      tutorPersonality:
        (settings?.tutorPersonality as TutorPersonality) || "Friendly Teacher",
      helpRequested: helpMode,
      memoryBlock: memory.memoryBlock,
    };

    if (res) {
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders?.();

      const writeEvent = (payload: unknown) => {
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
        // Flush through proxies when compression/buffering is present
        (res as Response & { flush?: () => void }).flush?.();
      };

      try {
        const iterator = aiService.streamReply(replyInput)[Symbol.asyncIterator]();
        let step = await iterator.next();
        while (!step.done) {
          const chunk = step.value;
          if (chunk) {
            writeEvent({ type: "token", content: chunk });
          }
          step = await iterator.next();
        }

        const parsed = step.value;
        const { assistantMessage, savedWords } = await persistAssistantTurn({
          userId,
          conversationId,
          conversation,
          dialogue: parsed.dialogue,
          correction: parsed.correction,
          helpMode,
          userMessage: content,
        });

        writeEvent({
          type: "done",
          message: {
            id: assistantMessage._id.toString(),
            role: "assistant",
            content: parsed.dialogue,
            correction: parsed.correction,
            helpMode,
            savedWords,
            createdAt: assistantMessage.createdAt,
          },
        });
        res.end();
      } catch (error) {
        console.error("Streaming chat failed:", error);
        try {
          writeEvent({
            type: "error",
            message:
              error instanceof Error
                ? error.message
                : "Polly could not generate a response.",
          });
        } catch {
          // response may already be closed
        }
        res.end();
      }
      return null;
    }

    const parsed = await aiService.generateReply(replyInput);
    const { assistantMessage, savedWords } = await persistAssistantTurn({
      userId,
      conversationId,
      conversation,
      dialogue: parsed.dialogue,
      correction: parsed.correction,
      helpMode,
      userMessage: content,
    });

    return {
      message: {
        id: assistantMessage._id.toString(),
        role: "assistant" as const,
        content: parsed.dialogue,
        correction: parsed.correction,
        helpMode,
        savedWords,
        createdAt: assistantMessage.createdAt,
      },
    };
  },
};
