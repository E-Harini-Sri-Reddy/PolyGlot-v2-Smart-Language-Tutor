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

export function buildChatContext(params: {
  systemPrompt: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  extraSystemNotes?: string[];
}): ChatMessage[] {
  const messages: ChatMessage[] = [
    { role: "system", content: params.systemPrompt },
  ];

  for (const note of params.extraSystemNotes ?? []) {
    messages.push({ role: "system", content: note });
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

  let correction: TutorCorrection | null = null;
  const payload = match[1]!.trim();
  const jsonText = extractJsonObject(payload) || payload;

  try {
    const parsed = JSON.parse(jsonText) as {
      encourage?: string;
      corrected?: string;
      translation?: string;
      explain?: string;
      why?: string;
      wordByWord?: Array<{ word?: string; meaning?: string }> | string;
    };

    let wordByWord: Array<{ word: string; meaning: string }> = [];
    if (Array.isArray(parsed.wordByWord)) {
      wordByWord = parsed.wordByWord
        .map((item) => ({
          word: String(item.word || "").trim(),
          meaning: String(item.meaning || "").trim(),
        }))
        .filter((item) => item.word && item.meaning);
    } else if (typeof parsed.wordByWord === "string" && parsed.wordByWord.trim()) {
      wordByWord = parsed.wordByWord
        .split(/[·|]/)
        .map((part: string) => {
          const pieces = part.split(/→|->|—|-/).map((s: string) => s.trim());
          return { word: pieces[0] || "", meaning: pieces[1] || "" };
        })
        .filter((item: { word: string; meaning: string }) => item.word && item.meaning);
    }

    const corrected = parsed.corrected?.trim() || "";
    // Only keep a correction card if we have something useful to show
    if (corrected || parsed.explain?.trim() || parsed.why?.trim()) {
      correction = {
        encourage: parsed.encourage?.trim() || "Great effort!",
        corrected,
        translation: parsed.translation?.trim() || "",
        wordByWord,
        explain: parsed.explain?.trim() || "",
        why: parsed.why?.trim() || parsed.explain?.trim() || "",
      };
    }
  } catch {
    correction = {
      encourage: "Great effort!",
      corrected: "",
      translation: "",
      wordByWord: [],
      explain: payload,
      why: "",
    };
  }

  const dialogue = raw.replace(CORRECTION_REGEX, "").trim();
  return { dialogue, correction, raw };
}
