export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type TutorCorrection = {
  encourage: string;
  corrected: string;
  translation: string;
  wordByWord: Array<{ word: string; meaning: string }>;
  explain: string;
  why: string;
};

export type ParsedAiReply = {
  dialogue: string;
  correction: TutorCorrection | null;
  raw: string;
};

const CORRECTION_REGEX =
  /<<<\s*CORRECTION\s*>>>\s*([\s\S]*?)\s*<<<\s*END\s*>>>/i;

function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  return null;
}

/** Fix common LLM JSON glitches before JSON.parse. */
function sanitizeCorrectionJson(text: string): string {
  let cleaned = text.trim();
  // Strip markdown fences if the model wraps JSON
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  // `" "corrected"` / `," key"` → proper keys
  cleaned = cleaned.replace(/,\s*"\s+"/g, ',"');
  cleaned = cleaned.replace(/"\s+([A-Za-z_][A-Za-z0-9_]*)"\s*:/g, '"$1":');
  cleaned = cleaned.replace(/{\s*"\s+"/g, '{"');
  // Trailing commas before } or ]
  cleaned = cleaned.replace(/,\s*([}\]])/g, "$1");
  // Smart quotes → straight quotes
  cleaned = cleaned.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  return cleaned;
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

function looksLikeRawJsonBlob(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (/^\s*\{[\s\S]*"\s*corrected\s*"\s*:/i.test(trimmed)) return true;
  if (/^\s*\{[\s\S]*"\s*encourage\s*"\s*:/i.test(trimmed)) return true;
  if (/^\s*\{[\s\S]*"\s*wordByWord\s*"\s*:/i.test(trimmed)) return true;
  return false;
}

function parseWordByWord(
  value: Array<{ word?: string; meaning?: string }> | string | undefined,
): Array<{ word: string; meaning: string }> {
  if (Array.isArray(value)) {
    return value
      .map((item) => ({
        word: String(item.word || "").trim(),
        meaning: String(item.meaning || "").trim(),
      }))
      .filter((item) => item.word && item.meaning);
  }
  if (typeof value === "string" && value.trim()) {
    return value
      .split(/[·|]/)
      .map((part: string) => {
        const pieces = part.split(/→|->|—|-/).map((s: string) => s.trim());
        return { word: pieces[0] || "", meaning: pieces[1] || "" };
      })
      .filter(
        (item: { word: string; meaning: string }) => item.word && item.meaning,
      );
  }
  return [];
}

function buildCorrectionFromFields(fields: {
  encourage?: string;
  corrected?: string;
  translation?: string;
  explain?: string;
  why?: string;
  wordByWord?: Array<{ word: string; meaning: string }>;
}): TutorCorrection | null {
  const corrected = fields.corrected?.trim() || "";
  let explain = fields.explain?.trim() || "";
  let why = fields.why?.trim() || "";
  // Never surface raw JSON blobs in explain/why
  if (looksLikeRawJsonBlob(explain)) explain = "";
  if (looksLikeRawJsonBlob(why)) why = "";
  if (!corrected && !explain && !why && !(fields.wordByWord?.length)) {
    return null;
  }
  return {
    encourage: fields.encourage?.trim() || "Great effort!",
    corrected,
    translation: fields.translation?.trim() || "",
    wordByWord: fields.wordByWord || [],
    explain,
    why: why || explain,
  };
}

/** Recover correction fields even when the model emits broken JSON. */
function parseCorrectionPayload(payload: string): TutorCorrection | null {
  const jsonText = sanitizeCorrectionJson(
    extractJsonObject(payload) || payload,
  );

  try {
    const parsed = JSON.parse(jsonText) as {
      encourage?: string;
      corrected?: string;
      translation?: string;
      explain?: string;
      why?: string;
      wordByWord?: Array<{ word?: string; meaning?: string }> | string;
    };
    return buildCorrectionFromFields({
      encourage: parsed.encourage,
      corrected: parsed.corrected,
      translation: parsed.translation,
      explain: parsed.explain,
      why: parsed.why,
      wordByWord: parseWordByWord(parsed.wordByWord),
    });
  } catch {
    // Loose field extraction from near-JSON — never dump raw payload into explain
    const corrected =
      extractQuotedField(jsonText, "corrected") ||
      extractQuotedField(payload, "corrected");
    const translation =
      extractQuotedField(jsonText, "translation") ||
      extractQuotedField(payload, "translation");
    const explain =
      extractQuotedField(jsonText, "explain") ||
      extractQuotedField(payload, "explain");
    const why =
      extractQuotedField(jsonText, "why") ||
      extractQuotedField(payload, "why");
    const encourage =
      extractQuotedField(jsonText, "encourage") ||
      extractQuotedField(payload, "encourage");
    const wordByWord =
      extractWordByWordLoose(jsonText).length > 0
        ? extractWordByWordLoose(jsonText)
        : extractWordByWordLoose(payload);

    return buildCorrectionFromFields({
      encourage,
      corrected,
      translation,
      explain,
      why,
      wordByWord,
    });
  }
}

export function buildChatContext(params: {
  systemPrompt: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  extraSystemNotes?: string[];
}): ChatMessage[] {
  const messages: ChatMessage[] = [
    { role: "system", content: params.systemPrompt },
  ];

  for (const note of params.extraSystemNotes ?? []) {
    messages.push({
      role: "system",
      content: note,
    });
  }

  const recent = params.history.slice(-25);
  for (const message of recent) {
    messages.push({
      role: message.role,
      content: message.content,
    });
  }

  return messages;
}

export function parseAiReply(raw: string): ParsedAiReply {
  const match = raw.match(CORRECTION_REGEX);
  if (!match) {
    return { dialogue: raw.trim(), correction: null, raw };
  }

  const payload = match[1]!.trim();
  const correction = parseCorrectionPayload(payload);
  const dialogue = raw.replace(CORRECTION_REGEX, "").trim();
  return { dialogue, correction, raw };
}
