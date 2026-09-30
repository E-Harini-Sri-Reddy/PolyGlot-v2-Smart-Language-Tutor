import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import {
  PROFICIENCY_LEVELS,
  SUPPORTED_LANGUAGES,
  type ProficiencyLevel,
  type SupportedLanguage,
} from "../constants/languages";
import {
  createConversation,
  deleteConversation,
  endConversation,
  getConversation,
  listConversations,
  regenerateMessage,
  streamMessage,
} from "../services/chatService";
import { listScenarios, type Scenario } from "../services/scenarioService";
import type { ChatMessage, Conversation } from "../types";
import { MessageBubble } from "../features/chat/components/MessageBubble";
import { ConfirmModal } from "../components/ConfirmModal";
import { ApiError } from "../services/api";
import { Trash2 } from "lucide-react";

function mapServerMessage(message: {
  _id?: string;
  id?: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt?: string;
  metadata?: ChatMessage["metadata"];
}): ChatMessage {
  return {
    id: message._id || message.id || crypto.randomUUID(),
    role: message.role,
    content: message.content,
    createdAt: message.createdAt,
    correction: message.metadata?.corrections?.[0] || null,
    helpMode: message.metadata?.helpMode,
    metadata: message.metadata,
  };
}

export function ChatPage() {
  const [language, setLanguage] = useState<SupportedLanguage>("Spanish");
  const [level, setLevel] = useState<ProficiencyLevel>("Beginner");
  const [customScenario, setCustomScenario] = useState("");
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [presets, setPresets] = useState<Scenario[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("Ready");
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [sending, setSending] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [sessionSummary, setSessionSummary] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const streamTargetRef = useRef("");
  const streamShownRef = useRef("");
  const streamPaceTimerRef = useRef<number | null>(null);

  function focusComposer() {
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }

  function stopStreamPacing() {
    if (streamPaceTimerRef.current != null) {
      window.clearInterval(streamPaceTimerRef.current);
      streamPaceTimerRef.current = null;
    }
  }

  function startStreamPacing(messageId: string) {
    if (streamPaceTimerRef.current != null) return;
    streamPaceTimerRef.current = window.setInterval(() => {
      const target = streamTargetRef.current;
      const shown = streamShownRef.current;
      if (target.length <= shown.length) return;

      // Reveal a few characters per tick so fast SSE bursts still feel gradual
      const step = target.length - shown.length > 80 ? 4 : 2;
      const next = target.slice(0, Math.min(target.length, shown.length + step));
      streamShownRef.current = next;
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, content: next } : m)),
      );
    }, 32);
  }

  const activeConversation = useMemo(
    () => conversations.find((c) => c._id === activeId) || null,
    [conversations, activeId],
  );

  const filteredPresets = useMemo(
    () =>
      presets.filter(
        (scenario) =>
          scenario.difficulty === level ||
          (level === "Advanced" && scenario.difficulty !== "Beginner"),
      ),
    [presets, level],
  );

  useEffect(() => {
    void (async () => {
      try {
        const [chatData, scenarioData] = await Promise.all([
          listConversations(),
          listScenarios(),
        ]);
        setConversations(chatData.conversations);
        setPresets(scenarioData.scenarios);
      } catch {
        // ignore first-load failures
      }
    })();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: streamingId ? "auto" : "smooth" });
  }, [messages, status, streamingId]);

  function visibleStreamText(raw: string): string {
    // Hide in-progress correction payloads so the spoken reply can stream cleanly
    let text = raw.replace(
      /<<<\s*CORRECTION\s*>>>[\s\S]*?(<<<\s*END\s*>>>|$)/gi,
      "",
    );
    // If a correction marker just started mid-chunk, cut from there
    const openIdx = text.search(/<<<\s*CORRECTION\s*>>>/i);
    if (openIdx >= 0) text = text.slice(0, openIdx);
    return text.replace(/^\s+/, "");
  }

  async function loadConversation(id: string) {
    setError(null);
    setStatus("Loading...");
    try {
      const data = await getConversation(id);
      setActiveId(id);
      setLanguage(data.conversation.language as SupportedLanguage);
      setLevel(data.conversation.level as ProficiencyLevel);
      setCustomScenario(data.conversation.scenarioText || "");
      setSelectedScenarioId(null);
      setMessages(data.messages.map(mapServerMessage));
      setStatus("Ready");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load conversation.");
      setStatus("Error");
    }
  }

  async function handleStart(mode: "free" | "preset" | "custom" = "free") {
    setStarting(true);
    setError(null);
    setStatus("Starting...");
    try {
      const payload: {
        language: SupportedLanguage;
        level: ProficiencyLevel;
        scenarioId?: string;
        customScenario?: string;
      } = { language, level };

      if (mode === "preset" && selectedScenarioId) {
        payload.scenarioId = selectedScenarioId;
      } else if (mode === "custom" && customScenario.trim()) {
        payload.customScenario = customScenario.trim();
      }

      const data = await createConversation(payload);
      setActiveId(data.conversation._id);
      setConversations((prev) => [data.conversation, ...prev]);
      setMessages([mapServerMessage(data.message as never)]);
      setStatus("Ready");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not start practice.");
      setStatus("Error");
    } finally {
      setStarting(false);
    }
  }

  async function handleEndSession() {
    if (!activeId) return;
    try {
      const result = await endConversation(activeId);
      setSessionSummary(
        result.summary?.summary ||
          "Great session! Your progress was saved to Learning DNA.",
      );
      setStatus("Session saved to memory");
      setActiveId(null);
      setMessages([]);
      const data = await listConversations();
      setConversations(data.conversations);
    } catch {
      setError("Could not end session.");
    }
  }

  function requestDeleteConversation(id: string, event?: MouseEvent) {
    event?.stopPropagation();
    setPendingDeleteId(id);
  }

  async function confirmDeleteConversation() {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    setDeleting(true);
    setError(null);
    try {
      await deleteConversation(id);
      if (activeId === id) {
        setActiveId(null);
        setMessages([]);
        setStatus("Ready");
        setSessionSummary(null);
      }
      setConversations((prev) => prev.filter((item) => item._id !== id));
      setPendingDeleteId(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete chat.");
    } finally {
      setDeleting(false);
    }
  }

  async function handleSend() {
    if (!activeId || !input.trim() || sending) return;
    const content = input.trim();
    setInput("");
    setSending(true);
    setError(null);
    setStatus("Polly is typing...");
    focusComposer();

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
    };
    const nextStreamingId = crypto.randomUUID();
    stopStreamPacing();
    streamTargetRef.current = "";
    streamShownRef.current = "";
    setStreamingId(nextStreamingId);
    setMessages((prev) => [
      ...prev,
      userMessage,
      { id: nextStreamingId, role: "assistant", content: "" },
    ]);

    let rawBuffer = "";

    await streamMessage(activeId, content, {
      onToken: (token) => {
        rawBuffer += token;
        const visible = visibleStreamText(rawBuffer);
        streamTargetRef.current = visible;
        setStatus(visible ? "Polly is replying..." : "Polly is typing...");
        startStreamPacing(nextStreamingId);
      },
      onDone: (message) => {
        const finalContent = message.content || "";
        streamTargetRef.current = finalContent;
        startStreamPacing(nextStreamingId);

        const settle = () => {
          stopStreamPacing();
          streamTargetRef.current = "";
          streamShownRef.current = "";
          setMessages((prev) =>
            prev.map((m) =>
              m.id === nextStreamingId
                ? {
                    id: message.id,
                    role: "assistant",
                    content: finalContent,
                    correction: message.correction,
                    helpMode: message.helpMode,
                    createdAt: message.createdAt,
                  }
                : m,
            ),
          );
          setStreamingId(null);
          setStatus("Ready");
          setSending(false);
          focusComposer();
        };

        // Let the paced reveal catch up before attaching correction / ending stream UI
        if (streamShownRef.current.length >= finalContent.length) {
          settle();
          return;
        }
        const watchId = window.setInterval(() => {
          if (streamShownRef.current.length >= finalContent.length) {
            window.clearInterval(watchId);
            settle();
          }
        }, 40);
        window.setTimeout(() => {
          window.clearInterval(watchId);
          settle();
        }, 4000);
      },
      onError: (message) => {
        stopStreamPacing();
        const partial = streamShownRef.current.trim();
        streamTargetRef.current = "";
        streamShownRef.current = "";
        setError(message);
        setStatus("Error");
        setSending(false);
        setStreamingId(null);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === nextStreamingId
              ? {
                  ...m,
                  content: partial || "We couldn't reach Polly. Please try again.",
                }
              : m,
          ),
        );
        focusComposer();
      },
    });
  }

  async function handleRegenerate(messageId: string) {
    if (!activeId || sending) return;
    setSending(true);
    setError(null);
    setStatus("Polly is rewriting...");
    stopStreamPacing();
    streamTargetRef.current = "";
    streamShownRef.current = "";
    setStreamingId(messageId);
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? { ...m, content: "", correction: null, helpMode: false }
          : m,
      ),
    );
    focusComposer();

    let rawBuffer = "";

    await regenerateMessage(activeId, messageId, {
      onToken: (token) => {
        rawBuffer += token;
        const visible = visibleStreamText(rawBuffer);
        streamTargetRef.current = visible;
        setStatus(visible ? "Polly is replying..." : "Polly is rewriting...");
        startStreamPacing(messageId);
      },
      onDone: (message) => {
        const finalContent = message.content || "";
        streamTargetRef.current = finalContent;
        startStreamPacing(messageId);

        const settle = () => {
          stopStreamPacing();
          streamTargetRef.current = "";
          streamShownRef.current = "";
          setMessages((prev) =>
            prev.map((m) =>
              m.id === messageId || m.id === message.id
                ? {
                    id: message.id,
                    role: "assistant",
                    content: finalContent,
                    correction: message.correction,
                    helpMode: message.helpMode,
                    createdAt: message.createdAt,
                  }
                : m,
            ),
          );
          setStreamingId(null);
          setStatus("Ready");
          setSending(false);
          focusComposer();
        };

        if (streamShownRef.current.length >= finalContent.length) {
          settle();
          return;
        }
        const watchId = window.setInterval(() => {
          if (streamShownRef.current.length >= finalContent.length) {
            window.clearInterval(watchId);
            settle();
          }
        }, 40);
        window.setTimeout(() => {
          window.clearInterval(watchId);
          settle();
        }, 4000);
      },
      onError: (message) => {
        stopStreamPacing();
        streamTargetRef.current = "";
        streamShownRef.current = "";
        setError(message);
        setStatus("Error");
        setSending(false);
        setStreamingId(null);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  content:
                    m.content?.trim() ||
                    "We couldn't regenerate Polly's reply. Please try again.",
                }
              : m,
          ),
        );
        focusComposer();
      },
    });
  }

  return (
    <div className="flex h-[calc(100vh-5.75rem)] min-h-[560px] overflow-hidden rounded-3xl border border-mist bg-white/70 shadow-sm">
      {/* LEFT SIDEBAR */}
      <aside className="flex w-full max-w-[300px] shrink-0 flex-col border-r border-mist bg-white/90">
        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          <section>
            <h2 className="font-display text-lg font-semibold text-ink">Practice setup</h2>
            <div className="mt-3 space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block text-ink-soft">Target language</span>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
                  className="w-full rounded-xl border border-mist bg-foam px-3 py-2.5"
                >
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <option key={lang} value={lang}>
                      {lang}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                <span className="mb-1 block text-ink-soft">Level</span>
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value as ProficiencyLevel)}
                  className="w-full rounded-xl border border-mist bg-foam px-3 py-2.5"
                >
                  {PROFICIENCY_LEVELS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                disabled={starting}
                onClick={() => void handleStart("free")}
                className="w-full rounded-xl bg-sea px-4 py-2.5 text-sm font-semibold text-white hover:bg-sea-deep disabled:opacity-60"
              >
                {starting ? "Starting..." : "Free conversation"}
              </button>

              {activeId && (
                <button
                  type="button"
                  onClick={() => void handleEndSession()}
                  className="w-full rounded-xl border border-mist bg-foam px-4 py-2.5 text-sm font-semibold text-ink"
                >
                  End session & save memory
                </button>
              )}
            </div>
          </section>

          <div className="h-px bg-mist" />

          <section>
            <h3 className="font-medium text-ink">Preset scenarios</h3>
            <div className="mt-3 max-h-44 space-y-2 overflow-y-auto pr-1">
              {filteredPresets.length === 0 ? (
                <p className="text-sm text-ink-soft">Loading scenarios...</p>
              ) : (
                filteredPresets.map((scenario) => (
                  <button
                    key={scenario._id}
                    type="button"
                    onClick={() => setSelectedScenarioId(scenario._id)}
                    className={`w-full rounded-xl px-3 py-2 text-left text-sm transition ${
                      selectedScenarioId === scenario._id
                        ? "bg-sea text-white"
                        : "bg-foam text-ink hover:bg-mist/60"
                    }`}
                  >
                    <span className="font-medium">
                      {scenario.icon || "💬"} {scenario.title}
                    </span>
                    <span
                      className={`mt-0.5 block text-xs ${
                        selectedScenarioId === scenario._id
                          ? "text-white/80"
                          : "text-ink-soft"
                      }`}
                    >
                      {scenario.difficulty} · {scenario.estimatedMinutes || 10} min
                    </span>
                  </button>
                ))
              )}
            </div>
            <button
              type="button"
              disabled={starting || !selectedScenarioId}
              onClick={() => void handleStart("preset")}
              className="mt-3 w-full rounded-xl bg-coral px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Start selected scenario
            </button>
          </section>

          <div className="h-px bg-mist" />

          <section>
            <h3 className="font-medium text-ink">Create your own</h3>
            <textarea
              value={customScenario}
              onChange={(e) => {
                setCustomScenario(e.target.value);
                setSelectedScenarioId(null);
              }}
              rows={3}
              placeholder='e.g. "I want to negotiate a salary."'
              className="mt-3 w-full rounded-xl border border-mist bg-foam px-3 py-2.5 text-sm"
            />
            <button
              type="button"
              disabled={starting || !customScenario.trim()}
              onClick={() => void handleStart("custom")}
              className="mt-3 w-full rounded-xl border border-mist bg-white px-4 py-2.5 text-sm font-semibold text-ink hover:bg-foam disabled:opacity-50"
            >
              Build custom scenario
            </button>
          </section>

          <div className="h-px bg-mist" />

          <section>
            <h3 className="font-medium text-ink">Recent chats</h3>
            <div className="mt-3 space-y-2">
              {conversations.length === 0 ? (
                <p className="text-sm text-ink-soft">No saved conversations yet.</p>
              ) : (
                conversations.map((conversation) => (
                  <div
                    key={conversation._id}
                    className={`flex items-stretch gap-1 rounded-xl transition ${
                      activeId === conversation._id
                        ? "bg-sea text-white"
                        : "bg-foam text-ink hover:bg-mist/60"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => void loadConversation(conversation._id)}
                      className="min-w-0 flex-1 px-3 py-2 text-left text-sm"
                    >
                      <span className="line-clamp-1 font-medium">{conversation.title}</span>
                      <span
                        className={`mt-0.5 block text-xs ${
                          activeId === conversation._id ? "text-white/80" : "text-ink-soft"
                        }`}
                      >
                        {conversation.language} · {conversation.level}
                      </span>
                    </button>
                    <button
                      type="button"
                      title="Delete chat"
                      onClick={(event) =>
                        requestDeleteConversation(conversation._id, event)
                      }
                      className={`m-1 rounded-lg px-2 ${
                        activeId === conversation._id
                          ? "text-white/80 hover:bg-white/15 hover:text-white"
                          : "text-ink-soft hover:bg-coral/10 hover:text-coral"
                      }`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </aside>

      {/* RIGHT CONVERSATION */}
      <section className="flex min-w-0 flex-1 flex-col bg-foam/30">
        <div className="flex items-center justify-between border-b border-mist bg-white/80 px-5 py-4">
          <div>
            <h2 className="font-display text-xl font-semibold text-ink">
              {activeConversation?.title || "Conversation"}
            </h2>
            <p className="text-sm text-ink-soft">
              Polly · {language} · {level}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-sea">{status}</span>
            {activeId && (
              <button
                type="button"
                title="Delete this chat"
                onClick={() => requestDeleteConversation(activeId)}
                className="inline-flex items-center gap-1 rounded-full bg-foam px-2.5 py-1 text-xs text-ink-soft hover:bg-coral/10 hover:text-coral"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            )}
          </div>
        </div>

        <div
          className={`min-h-0 flex-1 px-4 py-5 ${
            messages.length === 0 ? "overflow-hidden" : "space-y-4 overflow-y-auto"
          }`}
        >
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center text-center text-ink-soft">
              <div>
                <p className="font-display text-2xl text-ink">Ready when you are</p>
                <p className="mt-2 text-sm">
                  Use the left sidebar to start practicing.
                </p>
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                language={language}
                streaming={
                  message.id === streamingId ||
                  (sending &&
                    message.role === "assistant" &&
                    !message.content?.trim() &&
                    message.id === messages[messages.length - 1]?.id)
                }
                regenerating={sending && message.id === streamingId}
                onRegenerate={
                  message.role === "assistant" && !sending
                    ? (id) => void handleRegenerate(id)
                    : undefined
                }
              />
            ))
          )}
          {messages.length > 0 && <div ref={bottomRef} />}
        </div>

        {error && (
          <div className="border-t border-coral/20 bg-sand px-5 py-2 text-sm text-coral">
            {error}
          </div>
        )}

        {sessionSummary && (
          <div className="border-t border-sea/20 bg-white px-5 py-4">
            <h3 className="font-display text-lg text-ink">Session summary</h3>
            <p className="mt-1 text-sm text-ink-soft">{sessionSummary}</p>
            <button
              type="button"
              className="mt-2 text-sm font-medium text-sea"
              onClick={() => setSessionSummary(null)}
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="flex gap-3 border-t border-mist bg-white/90 p-4">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!sending && input.trim()) void handleSend();
              }
            }}
            disabled={!activeId}
            placeholder={
              activeId
                ? sending
                  ? "Polly is replying… you can keep typing"
                  : "Type in your target language..."
                : "Start practice from the left sidebar"
            }
            className="flex-1 rounded-xl border border-mist bg-foam px-4 py-3 outline-none ring-sea focus:ring-2 disabled:opacity-60"
          />
          <button
            type="button"
            disabled={!activeId || sending || !input.trim()}
            onClick={() => void handleSend()}
            className="rounded-xl bg-coral px-5 py-3 font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </section>

      <ConfirmModal
        open={Boolean(pendingDeleteId)}
        title="Delete this chat?"
        description="Messages and chat memory for this conversation will be removed. Your dictionary words and other chats will stay untouched."
        confirmLabel="Delete chat"
        cancelLabel="Keep chat"
        confirming={deleting}
        onCancel={() => {
          if (!deleting) setPendingDeleteId(null);
        }}
        onConfirm={() => void confirmDeleteConversation()}
      />
    </div>
  );
}
