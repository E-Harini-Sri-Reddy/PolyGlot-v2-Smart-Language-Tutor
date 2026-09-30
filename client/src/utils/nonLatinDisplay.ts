import { NON_LATIN_LANGUAGES, type SupportedLanguage } from "../constants/languages";

export type ScriptBlock = {
  native: string;
  romanization: string;
  english?: string;
};

function hasNativeScript(language: SupportedLanguage, text: string): boolean {
  switch (language) {
    case "Japanese":
      return /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(text);
    case "Chinese":
      return /[\u3400-\u4dbf\u4e00-\u9fff]/.test(text);
    case "Korean":
      return /[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/.test(text);
    case "Arabic":
      return /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/.test(text);
    case "Hindi":
      return /[\u0900-\u097f]/.test(text);
    default:
      return false;
  }
}

/** Common romanization particles / endings — not English prose. */
const ROMAJI_MARKERS =
  /\b(wa|ga|wo|o|ni|de|to|mo|ka|yo|ne|desu|masu|mashita|masen|kudasai|san|chan|kun|watashi|anata|ore|boku|hai|iie|konnichiwa|arigatou|sumimasen|kore|sore|are|doko|nani|dare|itsu|dou|genki|kimashita|sunde|imasu|porī|pori|polli|buli|poli|main|aap|hoon|se|hai|kahan|shahar|bharat|namaskar|mera|naam)\b/i;

function looksLikeRomanization(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (hasNativeScript("Japanese", trimmed) || hasNativeScript("Chinese", trimmed)) {
    return false;
  }
  if (hasNativeScript("Korean", trimmed) || hasNativeScript("Arabic", trimmed)) {
    return false;
  }
  if (hasNativeScript("Hindi", trimmed)) return false;
  // English gloss must not be treated as romanization
  if (looksLikeEnglishLine(trimmed)) return false;

  const latin = (trimmed.match(/[A-Za-zÀ-ÿĀ-žāīūēōĀĪŪĒŌ]/g) || []).length;
  if (latin / Math.max(trimmed.length, 1) < 0.4) return false;

  if (ROMAJI_MARKERS.test(trimmed)) return true;
  if (/[āīūēōĀĪŪĒŌ]/.test(trimmed)) return true;
  if (trimmed.split(/\s+/).length <= 12) return true;
  return latin / Math.max(trimmed.length, 1) > 0.55;
}

function looksLikeEnglishLine(text: string): boolean {
  const trimmed = text.trim().replace(/^English\s*:\s*/i, "");
  if (!trimmed) return false;
  if (ROMAJI_MARKERS.test(trimmed) && trimmed.split(/\s+/).length <= 8) return false;
  if (/[āīūēō]/.test(trimmed)) return false;
  if (hasNativeScript("Japanese", trimmed) || hasNativeScript("Chinese", trimmed)) {
    return false;
  }
  if (hasNativeScript("Korean", trimmed) || hasNativeScript("Arabic", trimmed)) {
    return false;
  }
  if (hasNativeScript("Hindi", trimmed)) return false;

  return (
    /^(i |i'm |i am |you |we |they |he |she |it |this |that |what |where |which |how |who |when |why |do |does |did |are |is |am |from |the |a |an )/i.test(
      trimmed,
    ) ||
    (/^[A-Za-z][A-Za-z0-9 ,'’?.!-]*[.?!]?$/.test(trimmed) &&
      trimmed.split(/\s+/).length >= 3 &&
      !ROMAJI_MARKERS.test(trimmed))
  );
}

function cleanLine(line: string): string {
  if (line.includes("|")) {
    const parts = line
      .split("|")
      .map((part) => part.trim())
      .filter(Boolean);
    const nativeHeavy = parts.some((part) =>
      /[\u3040-\u9fff\uac00-\ud7af\u0600-\u06ff\u0900-\u097f]/.test(part),
    );
    return nativeHeavy ? parts.join("") : parts.join(" ");
  }
  return line.trim().replace(/^English\s*:\s*/i, "");
}

/** Sentence-level native + romanization (+ optional English) blocks. */
export function buildScriptBlocks(
  content: string,
  language: SupportedLanguage,
): ScriptBlock[] {
  if (!NON_LATIN_LANGUAGES.includes(language)) return [];

  const rawLines = content
    .split(/\r?\n/)
    .map((line) => cleanLine(line))
    .filter(Boolean);

  const lines: string[] = [];
  for (const line of rawLines) {
    const mixed = line.match(
      /^([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Arabic}\p{Script=Devanagari}\s\p{P}\p{N}]+?)\s+([A-Za-zÀ-ÿĀ-žāīūēō].+)$/u,
    );
    if (
      mixed &&
      hasNativeScript(language, mixed[1]!) &&
      looksLikeRomanization(mixed[2]!)
    ) {
      lines.push(mixed[1]!.trim(), mixed[2]!.trim());
      continue;
    }
    lines.push(line);
  }

  const blocks: ScriptBlock[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;
    const next = lines[i + 1];
    const third = lines[i + 2];

    if (hasNativeScript(language, line) && next && looksLikeRomanization(next)) {
      const english =
        third && looksLikeEnglishLine(third) ? third.replace(/^English\s*:\s*/i, "") : "";
      blocks.push({
        native: line,
        romanization: next,
        english,
      });
      i += english ? 2 : 1;
      continue;
    }

    if (hasNativeScript(language, line)) {
      const english =
        next && looksLikeEnglishLine(next) ? next.replace(/^English\s*:\s*/i, "") : "";
      blocks.push({
        native: line,
        romanization: "",
        english,
      });
      if (english) i += 1;
    } else if (looksLikeRomanization(line)) {
      blocks.push({ native: "", romanization: line });
    } else if (looksLikeEnglishLine(line)) {
      blocks.push({
        native: "",
        romanization: "",
        english: line.replace(/^English\s*:\s*/i, ""),
      });
    }
  }

  return blocks.filter(
    (block) => block.native || block.romanization || block.english,
  );
}

export function extractEnglishLines(
  content: string,
  language: SupportedLanguage,
): string[] {
  if (NON_LATIN_LANGUAGES.includes(language)) {
    return buildScriptBlocks(content, language)
      .map((block) => block.english?.trim() || "")
      .filter(Boolean);
  }

  const lines = content
    .split(/\r?\n/)
    .map((line) => cleanLine(line))
    .filter(Boolean);
  // Prefer explicit trailing English-looking lines
  return lines.filter((line) => looksLikeEnglishLine(line));
}

export function hasRomanizationLine(
  content: string,
  language: SupportedLanguage,
): boolean {
  return buildScriptBlocks(content, language).some((block) =>
    Boolean(block.romanization?.trim()),
  );
}

export function nativeTextForSpeech(
  content: string,
  language: SupportedLanguage,
): string {
  const blocks = buildScriptBlocks(content, language);
  const native = blocks.map((block) => block.native).filter(Boolean).join(" ");
  return native || content;
}

export function isNonLatinLanguage(language: SupportedLanguage) {
  return NON_LATIN_LANGUAGES.includes(language);
}
