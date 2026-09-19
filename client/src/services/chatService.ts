import { apiFetch, getAccessToken } from "./api";
import type { ChatMessage, Conversation, TutorCorrection } from "../types";
import type { ProficiencyLevel, SupportedLanguage } from "../constants/languages";

type CreateConversationResponse = {
  success: boolean;
  conversation: Conversation;
  message: ChatMessage;
};

type ConversationDetailResponse = {
  success: boolean;
  conversation: Conversation;
  messages: Array<{
    _id: string;
    role: "user" | "assistant" | "system";
    content: string;
    createdAt?: string;
    metadata?: {
      corrections?: TutorCorrection[];
      helpMode?: boolean;
    };
  }>;
};

export async function createConversation(input: {
  language: SupportedLanguage;
  level: ProficiencyLevel;
  scenario?: string;
  scenarioId?: string;
  customScenario?: string;
}) {
  return apiFetch<CreateConversationResponse>("/api/chat/conversations", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function listConversations() {
  return apiFetch<{ success: boolean; conversations: Conversation[] }>(
    "/api/chat/conversations",
  );
}

export async function getConversation(id: string) {
  return apiFetch<ConversationDetailResponse>(`/api/chat/conversations/${id}`);
}

export async function endConversation(id: string) {
  return apiFetch<{
    success: boolean;
    summary?: {
      summary?: string;
      importantVocabulary?: string[];
      grammarFocus?: string[];
    } | null;
    conversation?: Conversation;
  }>(`/api/chat/conversations/${id}/end`, {
    method: "POST",
  });
}

export async function deleteConversation(id: string) {
  return apiFetch<{ success: boolean; deleted: boolean; conversationId: string }>(
    `/api/chat/conversations/${id}`,
    { method: "DELETE" },
  );
}

export type StreamHandlers = {
  onToken: (token: string) => void;
  onDone: (message: {
    id: string;
    role: "assistant";
    content: string;
    correction: TutorCorrection | null;
    helpMode?: boolean;
    savedWords?: string[];
    createdAt?: string;
  }) => void;
  onError: (message: string) => void;
};

export async function streamMessage(
  conversationId: string,
  content: string,
  handlers: StreamHandlers,
) {
  const response = await fetch(`/api/chat/conversations/${conversationId}/messages`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getAccessToken() || ""}`,
    },
    body: JSON.stringify({ content, stream: true }),
  });

  if (!response.ok || !response.body) {
    handlers.onError("We couldn't reach Polly. Please try again.");
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";

    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith("data:")) continue;
      const payload = line.replace(/^data:\s*/, "");
      try {
        const event = JSON.parse(payload) as {
          type: string;
          content?: string;
          message?: {
            id: string;
            role: "assistant";
            content: string;
            correction: TutorCorrection | null;
            helpMode?: boolean;
            createdAt?: string;
          };
        };
        if (event.type === "token" && event.content) {
          handlers.onToken(event.content);
        }
        if (event.type === "done" && event.message) {
          handlers.onDone(event.message);
        }
      } catch {
        // ignore malformed chunks
      }
    }
  }
}
