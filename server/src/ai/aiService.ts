import { aiClient } from "./client.js";
import { env } from "../config/env.js";
import {
  buildChatContext,
  parseAiReply,
  type ParsedAiReply,
  type TutorCorrection,
} from "./contextBuilder.js";
import {
  buildHelpDetection,
  buildSystemPrompt,
  countQuestions,
  hasNativeScript,
  type PromptBuildInput,
} from "./promptBuilder.js";
import {
  NON_LATIN_LANGUAGES,
  type ProficiencyLevel,
  type SupportedLanguage,
} from "../constants/languages.js";

export type GenerateReplyInput = PromptBuildInput & {
  history: Array<{ role: "user" | "assistant"; content: string }>;
};

const CORRECTION_NOTE = `CORRECTIONS (mandatory when applicable):
Write the spoken dialogue FIRST (so the learner sees it stream in immediately).
THEN, if the learner's latest message has a clear mistake — wrong conjugation, wrong particle, broken word order, missing words, misspelled/broken romaji, or unnatural beginner form — emit a <<<CORRECTION>>> ... <<<END>>> block AFTER the dialogue.
Do NOT skip the correction block just to keep chatting.
Do NOT correct Polly's own lines.
Do NOT correct clear, acceptable greetings/introductions with no real error.
When correcting, include encourage, corrected, translation, wordByWord, explain, and why as valid JSON (exact key names, no spaces inside quotes around keys).
Never put raw JSON into the dialogue text.`;

function turnTakingNote(learnerName?: string, lastUserMessage?: string): string {
  const name = learnerName?.trim() || "the learner";
  const last = lastUserMessage?.trim() || "";
  return `TURN-TAKING (mandatory for ALL languages):
- Learner's latest message: "${last.slice(0, 400)}"
- If that message asks a question (or ends with ? / か / 吗 / etc.), your FIRST sentence MUST answer it directly.
- Example: if they ask where you are from, say where Polly is from BEFORE asking anything else.
- Then you may ask at most ONE short follow-up related to their message.
- Never ignore their question. Never only ask a new question.
- You are Polly; address the learner as ${name}, never as Polly.`;
}

function scriptFormatNote(
  language: SupportedLanguage,
  learnerName?: string,
  showEnglishUnderReplies?: boolean,
): string {
  if (!NON_LATIN_LANGUAGES.includes(language)) {
    if (!showEnglishUnderReplies) return "";
    const name = learnerName?.trim() || "the learner";
    return `ENGLISH GLOSS (enabled): After the ${language} dialogue, add one plain English translation line.
No labels like "English:". You are Polly; call the learner ${name}.`;
  }
  const name = learnerName?.trim() || "the learner";
  if (showEnglishUnderReplies) {
    return `HARD REQUIREMENT for ${language}: ALWAYS output THREE lines —
Line 1: native script
Line 2: romanization for that exact text
Line 3: plain English translation of that exact text
Never omit romanization or English. No | separators. You are Polly; call the learner ${name}.`;
  }
  return `HARD REQUIREMENT for ${language}: ALWAYS output TWO lines —
Line 1: native script
Line 2: romanization for that exact text
Never omit romanization. No | separators. No English in dialogue. You are Polly; call the learner ${name}.`;
}

function beginnerNote(level?: ProficiencyLevel): string {
  if (level !== "Beginner") return "";
  return `BEGINNER: Max 1–2 short simple sentences. Max one question after answering. Stay on the scenario topic (e.g. introducing yourself). Do not invent unrelated settings.`;
}

function completionText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((part) => ("text" in part ? String(part.text) : "")).join("");
  }
  return "";
}

function isReasoningModel(model: string): boolean {
  return /gpt-oss|qwen3|minimax/i.test(model);
}

function extractMessageText(message: {
  content?: unknown;
  reasoning?: unknown;
} | null | undefined): string {
  const content = completionText(message?.content).trim();
  if (content) return content;
  // Last resort: some providers only return reasoning if misconfigured
  return completionText(message?.reasoning).trim();
}

function hasRomanizationText(text: string): boolean {
  const lines = text.split(/\n/).map((line) => line.trim()).filter(Boolean);
  return lines.some((line) => {
    if (/[\u3040-\u9fff\uac00-\ud7af\u0600-\u06ff\u0900-\u097f]/.test(line)) {
      return false;
    }
    if (looksLikeEnglishGloss(line)) return false;
    return /[A-Za-zÀ-ÿĀ-žāīūēō]/.test(line);
  });
}

function looksLikeEnglishGloss(text: string): boolean {
  const trimmed = text.trim().replace(/^English\s*:\s*/i, "");
  if (!trimmed) return false;
  if (/[\u3040-\u9fff\uac00-\ud7af\u0600-\u06ff\u0900-\u097f]/.test(trimmed)) {
    return false;
  }
  if (/[āīūēō]/.test(trimmed)) return false;
  // Romaji/Hinglish markers — not English gloss
  if (
    /\b(wa|ga|desu|masu|watashi|kahan|hoon|aap|hai|se|main|namaskar|mera|naam|porī)\b/i.test(
      trimmed,
    ) &&
    trimmed.split(/\s+/).length <= 10
  ) {
    return false;
  }
  return (
    /^(i |i'm |i am |you |we |they |he |she |it |this |that |what |where |which |how |who |when |why |do |does |did |are |is |am |from |the |a |an |yes |no |hi |hello |nice |great |sorry )/i.test(
      trimmed,
    ) ||
    (/^[A-Za-z][A-Za-z0-9 ,'’?.!-]*[.?!]?$/.test(trimmed) &&
      trimmed.split(/\s+/).length >= 4)
  );
}

function hasEnglishGloss(text: string): boolean {
  return text
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .some((line) => looksLikeEnglishGloss(line));
}

function needsNonLatinRepair(language: SupportedLanguage, dialogue: string): boolean {
  if (!NON_LATIN_LANGUAGES.includes(language)) return false;
  if (!hasNativeScript(language, dialogue)) return true;
  if (!hasRomanizationText(dialogue)) return true;
  if (/\([A-Za-z][^)]{3,}\)/.test(dialogue)) return true;
  if (dialogue.includes("|")) return true;
  if (
    /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af\u0600-\u06ff\u0900-\u097f].+[A-Za-z]{3,}/.test(
      dialogue.replace(/\n/g, " "),
    ) && !dialogue.includes("\n")
  ) {
    return true;
  }
  return false;
}

function needsBrevityRepair(
  level: ProficiencyLevel | undefined,
  dialogue: string,
  showEnglish?: boolean,
): boolean {
  if (level !== "Beginner") return false;
  if (countQuestions(dialogue) > 1) return true;
  const lines = dialogue.split(/\n/).filter((line) => line.trim());
  // Allow native + romanization + optional English (up to 2 sentence triples)
  const maxLines = showEnglish ? 6 : 4;
  if (lines.length > maxLines) return true;
  if (dialogue.replace(/\s+/g, "").length > (showEnglish ? 320 : 220)) return true;
  return false;
}

function learnerAskedQuestion(text?: string): boolean {
  if (!text?.trim()) return false;
  const t = text.trim();
  if (/[?？]/.test(t)) return true;
  if (/(ですか|ますか|の\s*\?|ka\s*\?|doko|nani|dare|itsu|dou|genki)/i.test(t)) {
    return true;
  }
  return /\b(where|what|how|who|when|why|are you|do you)\b/i.test(t);
}

/** True when reply looks like it only asks / pivots without answering. */
function needsAnswerFirstRepair(lastUserMessage: string | undefined, dialogue: string): boolean {
  if (!learnerAskedQuestion(lastUserMessage)) return false;
  const flat = dialogue.replace(/\n/g, " ").trim();
  if (!flat) return true;
  // Reply is only a question (or starts with why/where style pivot)
  const questionHeavy =
    countQuestions(dialogue) >= 1 &&
    /^(なぜ|何故|どこ|なに|何|だれ|誰|いつ|どう|naze|doko|nani|dare|itsu)\b/i.test(
      flat,
    );
  if (questionHeavy) return true;
  // Classic dodge: ask the learner a new scenario question without answering origin/name/etc.
  const askedOrigin = /(doko\s+kara|where\s+(are\s+you\s+)?from|どこから)/i.test(
    lastUserMessage || "",
  );
  if (askedOrigin) {
    const answeredOrigin =
      /(kara\s+(kimashita|desu)|から(来|き)|I('m| am) from|東京|大阪|日本|アメリカ|India|インド)/i.test(
        flat,
      );
    if (!answeredOrigin) return true;
  }
  return false;
}

function isLikelyTargetAttempt(text: string, language: SupportedLanguage): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length < 2) return false;
  if (buildHelpDetection(trimmed)) return false;
  if (hasNativeScript(language, trimmed)) return true;
  // Romaji / latin practice for non-Latin languages, or any non-English-looking attempt
  if (NON_LATIN_LANGUAGES.includes(language)) {
    return /[A-Za-zÀ-ÿĀ-žāīūēō]{2,}/.test(trimmed) && trimmed.split(/\s+/).length >= 2;
  }
  // Latin-script target languages: treat most non-help turns as practice
  return trimmed.split(/\s+/).length >= 2;
}

async function repairDialogue(input: {
  language: SupportedLanguage;
  level?: ProficiencyLevel;
  dialogue: string;
  learnerName?: string;
  lastUserMessage?: string;
  reason: "script" | "brevity" | "both";
  showEnglishUnderReplies?: boolean;
}): Promise<string> {
  const name = input.learnerName?.trim() || "the learner";
  const keepEnglish = Boolean(input.showEnglishUnderReplies);
  try {
    const completion = await aiClient.chat.completions.create({
      model: env.AI_MODEL,
      temperature: 0,
      max_completion_tokens: 420,
      ...(isReasoningModel(env.AI_MODEL) ? { include_reasoning: false } : {}),
      messages: [
        {
          role: "system",
          content: `Rewrite Polly's ${input.language} tutor reply.
Rules:
- You are Polly. Address the learner as ${name}. Never call the learner Polly.
- If the learner asked something, your FIRST sentence MUST answer it directly.
  Learner said: "${(input.lastUserMessage || "").slice(0, 300)}"
- Do not dodge with an unrelated scenario question.
- ${input.level === "Beginner" ? "Beginner: 1–2 short sentences max, only ONE question max." : "Keep it concise."}
${
  NON_LATIN_LANGUAGES.includes(input.language)
    ? keepEnglish
      ? `- Output EXACTLY:
Native script
Romanization
English translation
- No | characters.`
      : `- Output EXACTLY:
Native script
Romanization
- No English. No | characters.`
    : keepEnglish
      ? `- Output:
${input.language} dialogue
English translation
- No | characters.`
      : `- Output only the dialogue in ${input.language}. No English meta.`
}
- No correction block.`,
        },
        {
          role: "user",
          content: `Repair reason: ${input.reason}\n\n${input.dialogue.slice(0, 2000)}`,
        },
      ],
    } as never);

    const repaired = extractMessageText(
      (completion as { choices?: Array<{ message?: { content?: unknown } }> })
        .choices?.[0]?.message,
    )
      .trim()
      .replace(/\|/g, "");
    if (!repaired) return input.dialogue;

    if (NON_LATIN_LANGUAGES.includes(input.language)) {
      const okNative = hasNativeScript(input.language, repaired);
      const okRoma = hasRomanizationText(repaired);
      if (!okNative) return input.dialogue;
      if (okNative && okRoma) {
        if (keepEnglish && !hasEnglishGloss(repaired) && hasEnglishGloss(input.dialogue)) {
          // Keep original English if repair dropped it
          const englishLine = input.dialogue
            .split(/\n/)
            .map((l) => l.trim())
            .find((l) => looksLikeEnglishGloss(l));
          return englishLine ? `${repaired.trim()}\n${englishLine}` : repaired;
        }
        return repaired;
      }
      return repaired;
    }

    if (keepEnglish && !hasEnglishGloss(repaired) && hasEnglishGloss(input.dialogue)) {
      const englishLine = input.dialogue
        .split(/\n/)
        .map((l) => l.trim())
        .find((l) => looksLikeEnglishGloss(l));
      return englishLine ? `${repaired.trim()}\n${englishLine}` : repaired;
    }
    return repaired;
  } catch (error) {
    console.error("Dialogue repair failed:", error);
    return input.dialogue;
  }
}

function extractEnglishLinesFromDialogue(dialogue: string): string[] {
  return dialogue
    .split(/\n/)
    .map((line) => line.trim())
    .filter((line) => looksLikeEnglishGloss(line));
}

function appendPreservedEnglish(dialogue: string, englishLines: string[]): string {
  if (!englishLines.length) return dialogue;
  if (hasEnglishGloss(dialogue)) return dialogue;
  return `${dialogue.trim()}\n${englishLines.join("\n")}`.trim();
}

/** Focused pass: keep native lines, add romanization underneath. */
async function addRomanization(input: {
  language: SupportedLanguage;
  dialogue: string;
  keepEnglish?: boolean;
}): Promise<string> {
  if (!NON_LATIN_LANGUAGES.includes(input.language)) return input.dialogue;
  if (!hasNativeScript(input.language, input.dialogue)) return input.dialogue;
  if (hasRomanizationText(input.dialogue)) return input.dialogue;

  const preservedEnglish = input.keepEnglish
    ? extractEnglishLinesFromDialogue(input.dialogue)
    : [];

  try {
    const completion = await aiClient.chat.completions.create({
      model: env.AI_MODEL,
      temperature: 0,
      max_completion_tokens: 320,
      ...(isReasoningModel(env.AI_MODEL) ? { include_reasoning: false } : {}),
      messages: [
        {
          role: "system",
          content: `Add romanization under ${input.language} text.
Output ONLY:
Line(s) of the original native script (keep meaning; you may lightly fix if broken)
Matching full-sentence romanization on the next line(s)
${input.keepEnglish ? "Then keep any English translation line(s) last." : "No English."}
No | . No commentary.`,
        },
        {
          role: "user",
          content: input.dialogue.slice(0, 1500),
        },
      ],
    } as never);

    const repaired = extractMessageText(
      (completion as { choices?: Array<{ message?: { content?: unknown } }> })
        .choices?.[0]?.message,
    )
      .trim()
      .replace(/\|/g, "");
    if (
      repaired &&
      hasNativeScript(input.language, repaired) &&
      hasRomanizationText(repaired)
    ) {
      return appendPreservedEnglish(repaired, preservedEnglish);
    }
    return input.dialogue;
  } catch (error) {
    console.error("Romanization add failed:", error);
    return input.dialogue;
  }
}

/** Last-chance English gloss if stream/repair dropped it. */
async function ensureEnglishGloss(input: {
  language: SupportedLanguage;
  dialogue: string;
  learnerName?: string;
}): Promise<string> {
  if (hasEnglishGloss(input.dialogue)) return input.dialogue;
  const name = input.learnerName?.trim() || "the learner";
  try {
    const completion = await aiClient.chat.completions.create({
      model: env.AI_MODEL,
      temperature: 0,
      max_completion_tokens: 200,
      ...(isReasoningModel(env.AI_MODEL) ? { include_reasoning: false } : {}),
      messages: [
        {
          role: "system",
          content: `Append ONE plain English translation line under Polly's ${input.language} reply.
Keep every existing line exactly as-is. Add only the English meaning at the end.
No labels like "English:". Address the learner as ${name}. No | characters.`,
        },
        { role: "user", content: input.dialogue.slice(0, 1500) },
      ],
    } as never);

    const repaired = extractMessageText(
      (completion as { choices?: Array<{ message?: { content?: unknown } }> })
        .choices?.[0]?.message,
    )
      .trim()
      .replace(/\|/g, "");
    if (repaired && hasEnglishGloss(repaired) && repaired.includes(input.dialogue.split("\n")[0]!.trim().slice(0, 12))) {
      return repaired;
    }
    // If model returned only English, append it
    if (repaired && looksLikeEnglishGloss(repaired) && !repaired.includes("\n")) {
      return `${input.dialogue.trim()}\n${repaired}`;
    }
    return input.dialogue;
  } catch (error) {
    console.error("English gloss ensure failed:", error);
    return input.dialogue;
  }
}

async function ensureCorrection(input: {
  language: SupportedLanguage;
  level?: ProficiencyLevel;
  learnerMessage: string;
  existing: TutorCorrection | null;
}): Promise<TutorCorrection | null> {
  if (input.existing) return input.existing;
  if (!isLikelyTargetAttempt(input.learnerMessage, input.language)) {
    return null;
  }

  try {
    const completion = await aiClient.chat.completions.create({
      model: env.AI_MODEL,
      temperature: 0,
      max_tokens: 400,
      messages: [
        {
          role: "system",
          content: `You check a ${input.language} learner message (${input.level || "Beginner"}) for clear mistakes.
If the message is acceptable for this level (including simple greetings/intros), return exactly: NONE
If there is a clear mistake, return ONLY:
<<<CORRECTION>>>
{
  "encourage":"short encouragement",
  "corrected":"corrected version in ${input.language}${NON_LATIN_LANGUAGES.includes(input.language) ? " (native script + romanization if helpful)" : ""}",
  "translation":"English meaning of the corrected sentence",
  "wordByWord":[{"word":"...","meaning":"..."}],
  "explain":"brief English grammar note",
  "why":"brief English why this is better"
}
<<<END>>>`,
        },
        {
          role: "user",
          content: input.learnerMessage.slice(0, 500),
        },
      ],
    });

    const raw = completionText(completion.choices?.[0]?.message?.content).trim();
    if (!raw || /^NONE\b/i.test(raw)) return null;
    return parseAiReply(raw).correction;
  } catch (error) {
    console.error("Correction ensure failed:", error);
    return null;
  }
}

function ensureHelpHasEnglish(dialogue: string): string {
  if (!/##\s*How to Respond/i.test(dialogue)) return dialogue;
  const sectionMatch = dialogue.match(
    /##\s*How to Respond\s*([\s\S]*?)(?=\n##\s|$)/i,
  );
  if (!sectionMatch) return dialogue;
  const section = sectionMatch[1] || "";
  if (/^\s*English\s*:/im.test(section) || /\nEnglish\s*:/i.test(section)) {
    return dialogue;
  }
  // Append a placeholder cue so the UI shows the expectation; better filled by repair below
  return dialogue;
}

async function repairHelpEnglish(dialogue: string, language: SupportedLanguage): Promise<string> {
  if (!/##\s*How to Respond/i.test(dialogue)) return dialogue;
  const sectionMatch = dialogue.match(
    /##\s*How to Respond\s*([\s\S]*?)(?=\n##\s|$)/i,
  );
  if (!sectionMatch) return dialogue;
  const section = sectionMatch[1] || "";
  if (/English\s*:/i.test(section)) return dialogue;

  try {
    const completion = await aiClient.chat.completions.create({
      model: env.AI_MODEL,
      temperature: 0,
      max_tokens: 200,
      messages: [
        {
          role: "system",
          content: `In the How to Respond section below, add a final line:
English: <English translation of the suggested response>
Keep all other sections unchanged. Return the FULL help markdown.`,
        },
        { role: "user", content: dialogue.slice(0, 3000) },
      ],
    });
    const repaired = completionText(completion.choices?.[0]?.message?.content).trim();
    if (repaired && /##\s*How to Respond/i.test(repaired) && /English\s*:/i.test(repaired)) {
      return repaired;
    }
    return dialogue;
  } catch (error) {
    console.error("Help English repair failed:", error);
    return dialogue;
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function finalizeReply(
  input: GenerateReplyInput,
  parsed: ParsedAiReply,
  helpRequested: boolean,
  lastUserMessage?: string,
  options?: { fast?: boolean },
): Promise<ParsedAiReply> {
  const fast = Boolean(options?.fast);
  // Keep post-stream work short on Render (proxy idle timeouts)
  const repairBudgetMs = fast ? 6000 : 12000;
  const correctionBudgetMs = fast ? 4000 : 8000;
  const showEnglish = Boolean(input.showEnglishUnderReplies);

  if (helpRequested) {
    let dialogue = ensureHelpHasEnglish(parsed.dialogue);
    dialogue = await withTimeout(
      repairHelpEnglish(dialogue, input.language),
      repairBudgetMs,
      dialogue,
    );
    return { ...parsed, dialogue, correction: null };
  }

  let dialogue = parsed.dialogue.replace(/\|/g, "");
  let correction = parsed.correction;
  const preservedEnglish = showEnglish
    ? extractEnglishLinesFromDialogue(dialogue)
    : [];

  const scriptBad = needsNonLatinRepair(input.language, dialogue);
  const brevityBad = needsBrevityRepair(input.level, dialogue, showEnglish);
  const answerBad = needsAnswerFirstRepair(lastUserMessage, dialogue);

  if (scriptBad || brevityBad || answerBad) {
    dialogue = await withTimeout(
      repairDialogue({
        language: input.language,
        level: input.level,
        dialogue,
        learnerName: input.learnerName,
        lastUserMessage,
        reason: scriptBad && brevityBad ? "both" : scriptBad ? "script" : "brevity",
        showEnglishUnderReplies: showEnglish,
      }),
      repairBudgetMs,
      dialogue,
    );
    dialogue = appendPreservedEnglish(dialogue, preservedEnglish);
  }

  if (
    NON_LATIN_LANGUAGES.includes(input.language) &&
    hasNativeScript(input.language, dialogue) &&
    !hasRomanizationText(dialogue)
  ) {
    dialogue = await withTimeout(
      addRomanization({
        language: input.language,
        dialogue,
        keepEnglish: showEnglish,
      }),
      Math.min(repairBudgetMs, 5000),
      dialogue,
    );
    dialogue = appendPreservedEnglish(dialogue, preservedEnglish);
  }

  if (showEnglish && !hasEnglishGloss(dialogue)) {
    dialogue = await withTimeout(
      ensureEnglishGloss({
        language: input.language,
        dialogue,
        learnerName: input.learnerName,
      }),
      Math.min(repairBudgetMs, fast ? 3500 : 5000),
      appendPreservedEnglish(dialogue, preservedEnglish),
    );
  }

  // On the streaming/fast path, skip the extra correction round-trip to beat proxy timeouts.
  // The primary model reply already includes <<<CORRECTION>>> when needed.
  if (lastUserMessage && !fast) {
    correction = await withTimeout(
      ensureCorrection({
        language: input.language,
        level: input.level,
        learnerMessage: lastUserMessage,
        existing: correction,
      }),
      correctionBudgetMs,
      correction,
    );
  }

  return { ...parsed, dialogue, correction };
}

function isFailedPollyReply(content: string): boolean {
  return /Sorry\s*[—-]\s*Polly could not generate a response/i.test(content);
}

function sanitizeHistory(
  history: Array<{ role: "user" | "assistant"; content: string }>,
): Array<{ role: "user" | "assistant"; content: string }> {
  return history.filter((message) => {
    if (message.role !== "assistant") return true;
    return !isFailedPollyReply(message.content);
  });
}

function buildExtraNotes(
  input: GenerateReplyInput,
  helpRequested: boolean,
  lastUserMessage?: string,
): string[] {
  if (helpRequested) return [];
  const notes = [
    CORRECTION_NOTE,
    turnTakingNote(input.learnerName, lastUserMessage),
  ];
  const beginner = beginnerNote(input.level);
  if (beginner) notes.push(beginner);
  const script = scriptFormatNote(
    input.language,
    input.learnerName,
    input.showEnglishUnderReplies,
  );
  if (script) notes.push(script);
  return notes;
}

async function generateOnce(
  input: GenerateReplyInput,
  helpRequested: boolean,
  lastUserContent?: string,
): Promise<string> {
  const history = sanitizeHistory(input.history);
  const lastAssistant = [...history].reverse().find((m) => m.role === "assistant");

  const systemPrompt = buildSystemPrompt({
    ...input,
    helpRequested,
    lastAssistantMessage: lastAssistant?.content,
  });

  const messages = buildChatContext({
    systemPrompt,
    history,
    extraSystemNotes: buildExtraNotes(input, helpRequested, lastUserContent),
  });

  const response = await aiClient.chat.completions.create({
    messages,
    model: env.AI_MODEL,
    temperature: isReasoningModel(env.AI_MODEL)
      ? 0.6
      : input.level === "Beginner"
        ? 0.35
        : 0.45,
    max_completion_tokens: input.level === "Beginner" ? 900 : 1200,
    ...(isReasoningModel(env.AI_MODEL) ? { include_reasoning: false } : {}),
  } as never);

  const completion = response as {
    choices?: Array<{
      finish_reason?: string | null;
      message?: { content?: unknown; reasoning?: unknown };
    }>;
  };

  const reply = extractMessageText(completion.choices?.[0]?.message);
  if (!reply.trim()) {
    console.error("Empty AI reply", {
      model: env.AI_MODEL,
      finish: completion.choices?.[0]?.finish_reason,
    });
  }
  return reply;
}

export const aiService = {
  isHelpRequest(text: string) {
    return buildHelpDetection(text);
  },

  async generateReply(input: GenerateReplyInput): Promise<ParsedAiReply> {
    const history = sanitizeHistory(input.history);
    const lastUser = [...history].reverse().find((m) => m.role === "user");
    const helpRequested =
      input.helpRequested ?? (lastUser ? buildHelpDetection(lastUser.content) : false);

    let reply = await generateOnce(
      { ...input, history },
      helpRequested,
      lastUser?.content,
    );
    if (!reply.trim()) {
      reply = await generateOnce(
        { ...input, history },
        helpRequested,
        lastUser?.content,
      );
    }
    if (!reply.trim()) {
      reply = "Sorry — Polly could not generate a response. Please try again.";
    }

    return finalizeReply(
      { ...input, history },
      parseAiReply(reply),
      helpRequested,
      lastUser?.content,
    );
  },

  async *streamReply(input: GenerateReplyInput): AsyncGenerator<string, ParsedAiReply> {
    const history = sanitizeHistory(input.history);
    const lastUser = [...history].reverse().find((m) => m.role === "user");
    const helpRequested =
      input.helpRequested ?? (lastUser ? buildHelpDetection(lastUser.content) : false);

    const lastAssistant = [...history].reverse().find((m) => m.role === "assistant");

    const systemPrompt = buildSystemPrompt({
      ...input,
      helpRequested,
      lastAssistantMessage: lastAssistant?.content,
    });

    const messages = buildChatContext({
      systemPrompt,
      history,
      extraSystemNotes: buildExtraNotes(input, helpRequested, lastUser?.content),
    });

    const stream = (await aiClient.chat.completions.create({
      messages,
      model: env.AI_MODEL,
      temperature: isReasoningModel(env.AI_MODEL)
        ? 0.6
        : input.level === "Beginner"
          ? 0.35
          : 0.45,
      max_completion_tokens: input.level === "Beginner" ? 900 : 1200,
      stream: true,
      ...(isReasoningModel(env.AI_MODEL) ? { include_reasoning: false } : {}),
    } as never)) as unknown as AsyncIterable<{
      choices?: Array<{
        delta?: { content?: string | null; reasoning?: string | null };
      }>;
    }>;

    let raw = "";
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta;
      const piece = delta?.content || delta?.reasoning || "";
      if (!piece) continue;
      raw += piece;
      yield piece;
    }

    if (!raw.trim()) {
      console.error("Empty AI stream reply — falling back to non-stream", {
        model: env.AI_MODEL,
        language: input.language,
      });
      raw = await generateOnce(
        { ...input, history },
        helpRequested,
        lastUser?.content,
      );
      if (raw.trim()) {
        yield raw;
      } else {
        console.error("Empty AI reply after stream fallback", { model: env.AI_MODEL });
        raw = "Sorry — Polly could not generate a response. Please try again.";
        yield raw;
      }
    }

    return finalizeReply(
      { ...input, history },
      parseAiReply(raw),
      helpRequested,
      lastUser?.content,
      { fast: true },
    );
  },
};
