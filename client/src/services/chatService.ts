import { apiFetch, getAccessToken, refreshAccessToken } from "./api";
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
    replacedMessageId?: string;
  }) => void;
  onError: (message: string) => void;
};

async function authorizedFetch(
  path: string,
  init: RequestInit,
  signal?: AbortSignal,
) {
  const doFetch = () =>
    fetch(path, {
      ...init,
      credentials: "include",
      signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getAccessToken() || ""}`,
        ...(init.headers || {}),
      },
    });

  let response = await doFetch();
  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) response = await doFetch();
  }
  return response;
}

async function consumeSseStream(response: Response, handlers: StreamHandlers) {
  if (!response.ok) {
    let detail = "We couldn't reach Polly. Please try again.";
    try {
      const body = (await response.json()) as { message?: string };
      if (body?.message) detail = body.message;
    } catch {
      // ignore
    }
    if (response.status === 401) {
      detail = "Session expired. Please sign in again.";
    }
    handlers.onError(detail);
    return;
  }

  if (!response.body) {
    handlers.onError("We couldn't reach Polly. Please try again.");
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let receivedDone = false;
  let sawTokens = false;

  try {
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
            message?:
              | string
              | {
                  id: string;
                  role: "assistant";
                  content: string;
                  correction: TutorCorrection | null;
                  helpMode?: boolean;
                  createdAt?: string;
                  replacedMessageId?: string;
                };
          };

          if (event.type === "token" && event.content) {
            sawTokens = true;
            handlers.onToken(event.content);
          }
          if (
            event.type === "done" &&
            event.message &&
            typeof event.message === "object"
          ) {
            receivedDone = true;
            handlers.onDone(event.message);
          }
          if (event.type === "error") {
            const errMsg =
              typeof event.message === "string"
                ? event.message
                : "Polly could not generate a response.";
            handlers.onError(errMsg);
            return;
          }
        } catch {
          // ignore malformed chunks
        }
      }
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      handlers.onError("Polly took too long to reply. Please try again.");
    } else {
      handlers.onError("Connection to Polly was interrupted. Please try again.");
    }
    return;
  }

  if (!receivedDone) {
    if (sawTokens) {
      handlers.onError(
        "Polly's reply was interrupted before it finished. Please send again.",
      );
    } else {
      handlers.onError("We couldn't reach Polly. Please try again.");
    }
  }
}

export async function streamMessage(
  conversationId: string,
  content: string,
  handlers: StreamHandlers,
) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 90_000);

  try {
    const response = await authorizedFetch(
      `/api/chat/conversations/${conversationId}/messages`,
      {
        method: "POST",
        body: JSON.stringify({ content, stream: true }),
      },
      controller.signal,
    );
    await consumeSseStream(response, handlers);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      handlers.onError("Polly took too long to reply. Please try again.");
    } else {
      handlers.onError("We couldn't reach Polly. Please check your connection.");
    }
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function regenerateMessage(
  conversationId: string,
  messageId: string,
  handlers: StreamHandlers,
) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 90_000);

  try {
    const response = await authorizedFetch(
      `/api/chat/conversations/${conversationId}/messages/${messageId}/regenerate`,
      { method: "POST" },
      controller.signal,
    );
    await consumeSseStream(response, handlers);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      handlers.onError("Polly took too long to reply. Please try again.");
    } else {
      handlers.onError("We couldn't reach Polly. Please check your connection.");
    }
  } finally {
    window.clearTimeout(timeoutId);
  }
}
