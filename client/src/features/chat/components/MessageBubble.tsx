import { useEffect, useMemo, useState } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { BookmarkPlus, ChevronDown, RefreshCw, Volume2, X } from "lucide-react";
import type { ChatMessage, TutorCorrection } from "../../../types";
import {
  SPEECH_LANG_MAP,
  type SupportedLanguage,
} from "../../../constants/languages";
import { speakText } from "../../../utils/speech";
import { saveWordFromContext } from "../../../services/dictionaryService";
import {
  buildScriptBlocks,
  extractEnglishLines,
  isNonLatinLanguage,
  nativeTextForSpeech,
} from "../../../utils/nonLatinDisplay";

function renderMarkdown(text: string) {
  const html = marked.parse(text, { async: false }) as string;
  return DOMPurify.sanitize(html);
}

function looksLikeRawJsonBlob(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  return (
    /^\s*\{[\s\S]*"\s*corrected\s*"\s*:/i.test(trimmed) ||
    /^\s*\{[\s\S]*"\s*encourage\s*"\s*:/i.test(trimmed) ||
    /^\s*\{[\s\S]*"\s*wordByWord\s*"\s*:/i.test(trimmed)
  );
}

function extractQuotedField(text: string, field: string): string {
  const re = new RegExp(
    `"\\s*${field}\\s*"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`,
    "i",
  );
  const match = text.match(re);
  if (!match?.[1]) return "";
  return match[1]
    .replace(/\\n/g, "\n")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\")
    .trim();
}

function extractWordByWordLoose(
  text: string,
): Array<{ word: string; meaning: string }> {
  const block = text.match(/"\s*wordByWord\s*"\s*:\s*\[([\s\S]*?)\]/i);
  if (!block?.[1]) return [];
  const items: Array<{ word: string; meaning: string }> = [];
  const objectRe =
    /\{\s*"\s*word\s*"\s*:\s*"((?:\\.|[^"\\])*)"\s*,\s*"\s*meaning\s*"\s*:\s*"((?:\\.|[^"\\])*)"\s*\}/gi;
  let match: RegExpExecArray | null;
  while ((match = objectRe.exec(block[1])) !== null) {
    const word = match[1]?.replace(/\\"/g, '"').trim() || "";
    const meaning = match[2]?.replace(/\\"/g, '"').trim() || "";
    if (word && meaning) items.push({ word, meaning });
  }
  return items;
}

function recoverCorrectionFromJsonBlob(
  blob: string,
): Partial<TutorCorrection> | null {
  if (!looksLikeRawJsonBlob(blob)) return null;
  let cleaned = blob.trim();
  cleaned = cleaned.replace(/,\s*"\s+"/g, ',"');
  cleaned = cleaned.replace(/"\s+([A-Za-z_][A-Za-z0-9_]*)"\s*:/g, '"$1":');
  cleaned = cleaned.replace(/{\s*"\s+"/g, '{"');
  cleaned = cleaned.replace(/,\s*([}\]])/g, "$1");

  try {
    const parsed = JSON.parse(cleaned) as TutorCorrection;
    return {
      encourage: parsed.encourage,
      corrected: parsed.corrected,
      translation: parsed.translation,
      wordByWord: Array.isArray(parsed.wordByWord) ? parsed.wordByWord : [],
      explain: parsed.explain,
      why: parsed.why,
    };
  } catch {
    return {
      encourage: extractQuotedField(blob, "encourage"),
      corrected: extractQuotedField(blob, "corrected"),
      translation: extractQuotedField(blob, "translation"),
      explain: extractQuotedField(blob, "explain"),
      why: extractQuotedField(blob, "why"),
      wordByWord: extractWordByWordLoose(blob),
    };
  }
}

/** Never show raw correction JSON in the card; recover fields when possible. */
function sanitizeCorrectionForDisplay(
  correction: TutorCorrection | null | undefined,
): TutorCorrection | null {
  if (!correction) return null;

  const blobSource = [correction.explain, correction.why, correction.corrected]
    .filter((part) => looksLikeRawJsonBlob(part || ""))
    .join("\n");
  const recovered = blobSource
    ? recoverCorrectionFromJsonBlob(blobSource)
    : null;

  const explainRaw = recovered?.explain ?? correction.explain ?? "";
  const whyRaw = recovered?.why ?? correction.why ?? "";
  const explain = looksLikeRawJsonBlob(explainRaw) ? "" : explainRaw.trim();
  const why = looksLikeRawJsonBlob(whyRaw) ? "" : whyRaw.trim();
  const corrected = (
    recovered?.corrected ||
    correction.corrected ||
    ""
  ).trim();
  const translation = (
    recovered?.translation ||
    correction.translation ||
    ""
  ).trim();
  const wordByWord = (
    recovered?.wordByWord?.length
      ? recovered.wordByWord
      : correction.wordByWord || []
  ).filter((item) => item.word?.trim() && item.meaning?.trim());

  if (!corrected && !explain && !why && wordByWord.length === 0 && !translation) {
    return null;
  }
  return {
    ...correction,
    corrected,
    translation,
    wordByWord,
    explain,
    why: why || explain,
    encourage:
      recovered?.encourage?.trim() ||
      correction.encourage?.trim() ||
      "Great effort!",
  };
}

type TextSegment = {
  text: string;
  isWord: boolean;
};

function tokenizeForSave(text: string, language: SupportedLanguage): TextSegment[] {
  const locale = SPEECH_LANG_MAP[language] || "en";
  try {
    const SegmenterCtor = (
      Intl as typeof Intl & {
        Segmenter?: new (
          locales?: string | string[],
          options?: { granularity?: "grapheme" | "word" | "sentence" },
        ) => {
          segment: (input: string) => Iterable<{ segment: string; isWordLike?: boolean }>;
        };
      }
    ).Segmenter;

    if (SegmenterCtor) {
      const segmenter = new SegmenterCtor(locale, { granularity: "word" });
      return [...segmenter.segment(text)].map((part) => ({
        text: part.segment,
        isWord: Boolean(part.isWordLike) && part.segment.trim().length > 0,
      }));
    }
  } catch {
    // fall through
  }

  const segments: TextSegment[] = [];
  const pattern = /[\p{L}\p{M}\p{N}'’\-]+|[^\p{L}\p{M}\p{N}'’\-]+/gu;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const value = match[0];
    segments.push({
      text: value,
      isWord: /[\p{L}\p{N}]/u.test(value),
    });
  }
  return segments;
}

function buildKnownMeanings(message: ChatMessage) {
  const map = new Map<string, { meaning: string; pronunciation?: string }>();
  const correction = sanitizeCorrectionForDisplay(
    message.correction || message.metadata?.corrections?.[0] || null,
  );

  for (const item of correction?.wordByWord || []) {
    const key = item.word.trim().toLowerCase();
    if (!key || !item.meaning?.trim()) continue;
    map.set(key, { meaning: item.meaning.trim() });
  }

  for (const line of (message.content || "").split("\n")) {
    const cleaned = line.replace(/^[-*]\s*/, "").trim();
    const match = cleaned.match(
      /^(.+?)\s*(?:→|->|—|-)\s*(.+?)\s*(?:→|->|—|-)\s*(.+)$/,
    );
    if (!match) continue;
    const word = match[1]!.trim();
    const pronunciation = match[2]!.trim();
    const meaning = match[3]!.trim();
    if (word && meaning) {
      map.set(word.toLowerCase(), { meaning, pronunciation });
    }
  }

  return map;
}

function ScriptDialogue({
  content,
  language,
  pickMode,
  savedWords,
  savingWord,
  knownMeanings,
  onWordClick,
  showEnglish = false,
}: {
  content: string;
  language: SupportedLanguage;
  pickMode: boolean;
  savedWords: Set<string>;
  savingWord: string | null;
  knownMeanings: Map<string, { meaning: string; pronunciation?: string }>;
  onWordClick: (word: string) => void;
  showEnglish?: boolean;
}) {
  const blocks = useMemo(
    () => buildScriptBlocks(content, language),
    [content, language],
  );

  if (blocks.length === 0) {
    return (
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{content}</p>
    );
  }

  return (
    <div className="space-y-3">
      {blocks.map((block, index) => {
        const nativeSegments = pickMode
          ? tokenizeForSave(block.native, language)
          : [];

        return (
          <div key={`block-${index}-${block.native.slice(0, 12)}`}>
            {pickMode && block.native ? (
              <p className="text-base leading-relaxed text-ink">
                {nativeSegments.map((segment, segIndex) => {
                  if (!segment.isWord) {
                    return <span key={`sep-${index}-${segIndex}`}>{segment.text}</span>;
                  }
                  const key = segment.text.toLowerCase();
                  const isSaved = savedWords.has(key);
                  const isSaving = savingWord === segment.text;
                  return (
                    <button
                      key={`word-${index}-${segIndex}-${segment.text}`}
                      type="button"
                      disabled={Boolean(savingWord)}
                      onClick={() => onWordClick(segment.text)}
                      className={`mx-0.5 rounded px-0.5 transition ${
                        isSaved
                          ? "bg-sea/20 text-sea"
                          : "bg-coral/15 text-ink hover:bg-coral/25"
                      } ${isSaving ? "opacity-60" : ""}`}
                      title={
                        knownMeanings.get(key)?.meaning ||
                        "Save this word to your dictionary"
                      }
                    >
                      {segment.text}
                    </button>
                  );
                })}
              </p>
            ) : (
              <p className="text-base leading-relaxed text-ink">{block.native}</p>
            )}
            {block.romanization ? (
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                {block.romanization}
              </p>
            ) : null}
            {showEnglish && block.english ? (
              <p className="mt-1 text-sm leading-relaxed text-ink/80">
                {block.english}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function MessageBubble({
  message,
  language,
  streaming = false,
  onRegenerate,
  regenerating = false,
  showEnglishUnderReplies = false,
}: {
  message: ChatMessage;
  language: SupportedLanguage;
  streaming?: boolean;
  onRegenerate?: (messageId: string) => void;
  regenerating?: boolean;
  showEnglishUnderReplies?: boolean;
}) {
  const correction = sanitizeCorrectionForDisplay(
    message.correction || message.metadata?.corrections?.[0] || null,
  );
  const [open, setOpen] = useState(Boolean(correction));

  useEffect(() => {
    if (correction) setOpen(true);
  }, [correction]);
  const [pickMode, setPickMode] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [savingWord, setSavingWord] = useState<string | null>(null);
  const [savedWords, setSavedWords] = useState<Set<string>>(() => new Set());

  const html = useMemo(
    () => renderMarkdown(message.content || ""),
    [message.content],
  );

  const knownMeanings = useMemo(() => buildKnownMeanings(message), [message]);
  const isUser = message.role === "user";
  const useScriptLayout =
    !isUser && !streaming && !message.helpMode && isNonLatinLanguage(language);

  const fallbackSegments = useMemo(
    () => tokenizeForSave(message.content || "", language),
    [message.content, language],
  );

  async function handleWordClick(word: string) {
    const cleaned = word.trim();
    if (!cleaned || savingWord) return;

    const known = knownMeanings.get(cleaned.toLowerCase());
    const blocks = buildScriptBlocks(message.content || "", language);
    const block = blocks.find((item) => item.native.includes(cleaned));
    const focusedContext = block
      ? `${block.native}\n${block.romanization}`.trim()
      : message.content || cleaned;

    setSavingWord(cleaned);
    setSaveStatus(null);
    try {
      const result = await saveWordFromContext({
        word: cleaned,
        language,
        context: focusedContext,
        // Only pass meaning hints from correction/help glosses for this exact word
        knownMeaning: known?.meaning,
        pronunciation: known?.pronunciation,
      });
      setSavedWords((prev) => new Set(prev).add(cleaned.toLowerCase()));
      setSaveStatus(
        result.created
          ? `Saved “${cleaned}” → ${result.entry.meaning}`
          : `Updated “${cleaned}” → ${result.entry.meaning}`,
      );
    } catch {
      setSaveStatus(`Could not save “${cleaned}”`);
    } finally {
      setSavingWord(null);
    }
  }

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm sm:max-w-[75%] ${
          isUser
            ? "rounded-br-md bg-sea text-white"
            : "rounded-bl-md border border-mist bg-white text-ink"
        }`}
      >
        {!isUser && correction && (
          <div className="mb-3 rounded-xl border border-coral/30 bg-sand/80">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium text-ink"
              onClick={() => setOpen((v) => !v)}
            >
              <span>{correction.encourage || "Almost there!"} · View correction</span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 transition ${open ? "rotate-180" : ""}`}
              />
            </button>
            {open && (
              <div className="space-y-3 border-t border-coral/20 px-3 py-3 text-sm text-ink-soft">
                {correction.corrected && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink">
                      Corrected sentence
                    </p>
                    <p className="mt-1 text-ink">{correction.corrected}</p>
                  </div>
                )}

                {correction.translation && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink">
                      English translation
                    </p>
                    <p className="mt-1">{correction.translation}</p>
                  </div>
                )}

                {correction.wordByWord && correction.wordByWord.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink">
                      Word-by-word
                    </p>
                    <ul className="mt-1 space-y-1">
                      {correction.wordByWord.map((item) => (
                        <li key={`${item.word}-${item.meaning}`}>
                          <span className="font-medium text-ink">{item.word}</span>
                          <span> → {item.meaning}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {(correction.why || correction.explain) && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink">
                      Why this is better
                    </p>
                    <p className="mt-1">{correction.why || correction.explain}</p>
                    {correction.why &&
                      correction.explain &&
                      correction.why !== correction.explain && (
                        <p className="mt-2">{correction.explain}</p>
                      )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {!isUser && streaming ? (
          <div className="text-sm leading-relaxed text-ink" aria-live="polite">
            {message.content?.trim() ? (
              <p className="whitespace-pre-wrap">
                {message.content}
                <span
                  className="ml-0.5 inline-block h-4 w-[2px] translate-y-[2px] animate-pulse bg-sea align-middle"
                  aria-hidden
                />
              </p>
            ) : (
              <p
                className="flex items-center gap-1.5 py-0.5 text-2xl leading-none tracking-[0.2em] text-ink-soft"
                aria-label="Polly is typing"
              >
                <span className="inline-block animate-bounce [animation-delay:-0.3s]">.</span>
                <span className="inline-block animate-bounce [animation-delay:-0.15s]">.</span>
                <span className="inline-block animate-bounce">.</span>
              </p>
            )}
          </div>
        ) : !isUser && useScriptLayout ? (
          <div>
            {pickMode && (
              <p className="mb-2 text-xs text-ink-soft">
                Tap a word in the native script to save it.
              </p>
            )}
            <ScriptDialogue
              content={message.content || ""}
              language={language}
              pickMode={pickMode}
              savedWords={savedWords}
              savingWord={savingWord}
              knownMeanings={knownMeanings}
              onWordClick={(word) => void handleWordClick(word)}
              showEnglish={showEnglishUnderReplies}
            />
          </div>
        ) : pickMode && !isUser ? (
          <div className="text-sm leading-relaxed text-ink">
            <p className="mb-2 text-xs text-ink-soft">
              Tap a highlighted word to save it with its meaning.
            </p>
            <p className="whitespace-pre-wrap">
              {fallbackSegments.map((segment, index) => {
                if (!segment.isWord) {
                  return <span key={`sep-${index}`}>{segment.text}</span>;
                }
                const key = segment.text.toLowerCase();
                const isSaved = savedWords.has(key);
                const isSaving = savingWord === segment.text;
                return (
                  <button
                    key={`word-${index}-${segment.text}`}
                    type="button"
                    disabled={Boolean(savingWord)}
                    onClick={() => void handleWordClick(segment.text)}
                    className={`mx-0.5 rounded px-0.5 transition ${
                      isSaved
                        ? "bg-sea/20 text-sea underline decoration-sea/40"
                        : "bg-coral/15 text-ink underline decoration-dotted decoration-coral/70 hover:bg-coral/25"
                    } ${isSaving ? "opacity-60" : ""}`}
                    title={
                      knownMeanings.get(key)?.meaning ||
                      "Save this word to your dictionary"
                    }
                  >
                    {segment.text}
                  </button>
                );
              })}
            </p>
          </div>
        ) : (
          <div
            className={`prose prose-sm max-w-none ${
              isUser ? "prose-invert" : "prose-slate"
            }`}
          >
            {!isUser && showEnglishUnderReplies && !message.helpMode ? (
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-ink not-prose">
                {(message.content || "")
                  .split(/\r?\n/)
                  .map((line) => line.trim())
                  .filter(Boolean)
                  .map((line, index, arr) => {
                    const englishLines = extractEnglishLines(
                      message.content || "",
                      language,
                    );
                    const isEnglish =
                      englishLines.includes(line) ||
                      englishLines.includes(line.replace(/^English\s*:\s*/i, ""));
                    return (
                      <p
                        key={`${index}-${line.slice(0, 12)}`}
                        className={
                          isEnglish
                            ? "mt-1 text-ink/80"
                            : index === arr.length - 1 && isEnglish
                              ? "text-ink/80"
                              : "text-ink"
                        }
                      >
                        {line.replace(/^English\s*:\s*/i, "")}
                      </p>
                    );
                  })}
              </div>
            ) : (
              <div dangerouslySetInnerHTML={{ __html: html }} />
            )}
          </div>
        )}

        {!isUser && !streaming && Boolean(message.content?.trim()) && (
          <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
            {message.helpMode && (
              <span className="rounded-full bg-sand px-2 py-1 text-xs text-ink-soft">
                Help words auto-saved
              </span>
            )}
            {saveStatus && (
              <span className="max-w-[14rem] truncate text-xs text-sea" title={saveStatus}>
                {saveStatus}
              </span>
            )}
            <button
              type="button"
              title={pickMode ? "Cancel word picker" : "Save word"}
              onClick={() => {
                setPickMode((value) => !value);
                setSaveStatus(
                  pickMode ? null : "Pick a word below to save it",
                );
              }}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${
                pickMode
                  ? "bg-coral/15 text-coral"
                  : "bg-foam text-ink-soft hover:text-ink"
              }`}
            >
              {pickMode ? (
                <>
                  <X className="h-3.5 w-3.5" />
                  Done
                </>
              ) : (
                <>
                  <BookmarkPlus className="h-3.5 w-3.5" />
                  Save word
                </>
              )}
            </button>
            <button
              type="button"
              title="Listen to pronunciation"
              onClick={() =>
                speakText(
                  nativeTextForSpeech(message.content || "", language),
                  language,
                )
              }
              className="inline-flex items-center gap-1 rounded-full bg-foam px-2.5 py-1 text-xs text-ink-soft hover:text-ink"
            >
              <Volume2 className="h-3.5 w-3.5" />
              Listen
            </button>
            {onRegenerate && (
              <button
                type="button"
                title="New response"
                disabled={regenerating}
                onClick={() => onRegenerate(message.id)}
                className="inline-flex items-center gap-1 rounded-full bg-foam px-2.5 py-1 text-xs text-ink-soft hover:text-ink disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${regenerating ? "animate-spin" : ""}`}
                />
                New response
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
