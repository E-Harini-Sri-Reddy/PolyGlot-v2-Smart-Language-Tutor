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

const ENGLISH_FUNCTION_WORDS =
  /\b(the|and|or|but|with|from|that|this|these|those|what|where|which|when|why|who|how|you|your|yours|i'm|i am|we|they|them|his|her|she|he|it's|is|are|was|were|be|been|have|has|had|do|does|did|not|don't|hello|welcome|please|thanks|thank|yes|no|sorry|great|nice|because|about|into|just|like|want|would|could|should|can|will|for|our|my|me)\b/gi;

const ENGLISH_STARTERS =
  /^(i |i'm |i am |you |we |they |he |she |it |this |that |what |where |which |how |who |when |why |do |does |did |are |is |am |from |the |a |an |yes |no |hi |hello |hey |nice |great |sorry |please |thank |thanks |welcome |my )/i;

function romanizationMarker(language: SupportedLanguage): RegExp | null {
  switch (language) {
    case "Japanese":
      return /\b(wa|ga|wo|o|ni|de|to|mo|ka|yo|ne|desu|masu|mashita|masen|kudasai|san|chan|kun|watashi|anata|ore|boku|hai|iie|konnichiwa|arigatou|sumimasen|kore|sore|are|doko|nani|dare|itsu|dou|genki|imasu|deshita)\b|[āīūēōĀĪŪĒŌ]/i;
    case "Korean":
      return /\b(annyeong|haseyo|hamnida|seumnida|imnida|jinaeyo|gwaenchanh|gomawo|jeoneun|ireum|eoseo|hwanyeong|jeo|aniyo|gwa|hago|nida|yeyo|ayo|eyo|eun|neun|eul|reul|eseo)\b|-(eun|neun|eul|reul|yo|eyo|yeyo)\b/i;
    case "Hindi":
      return /\b(hai|hain|hoon|hun|aap|main|mein|kya|kaise|kahan|namaste|ka|ki|ke|se|ko|par|raha|rahi|nahi|ji|aur|mera|meri|naam|swagat|dhanyavaad|kripya|theek|accha|achha|kyun|woh|yeh|aapke|aapka|mujhe|tum|hum|hoga|karo|karna)\b/i;
    case "Chinese":
      return /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüĀÁǍÀĒÉĚÈĪÍǏÌŌÓǑÒŪÚǓÙ]|(\b(nǐ|wǒ|hǎo|shì|ma|ne|le|men|xièxie)\b)/i;
    case "Arabic":
      return /\b(marhaba|marhaban|kayfa|haluk|ismi|anta|anti|shukran|ahlan|haluki|ismee)\b/i;
    default:
      return null;
  }
}

function isLatinLine(text: string): boolean {
  const latin = (text.match(/[A-Za-zÀ-ÿĀ-žāīūēōĀĪŪĒŌ]/g) || []).length;
  return latin / Math.max(text.length, 1) >= 0.4;
}

function looksLikeRomanization(text: string, language: SupportedLanguage): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (hasNativeScript("Japanese", trimmed) || hasNativeScript("Chinese", trimmed)) {
    return false;
  }
  if (hasNativeScript("Korean", trimmed) || hasNativeScript("Arabic", trimmed)) {
    return false;
  }
  if (hasNativeScript("Hindi", trimmed)) return false;
  if (!isLatinLine(trimmed)) return false;
  if (looksLikeEnglishLine(trimmed, language)) return false;

  const marker = romanizationMarker(language);
  if (marker?.test(trimmed)) return true;
  if (/[āīūēōĀĪŪĒŌāáǎàēéěèīíǐìōóǒòūúǔù]/.test(trimmed)) return true;
  return false;
}

function looksLikePhoneticLine(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (/[\u3040-\u9fff\uac00-\ud7af\u0600-\u06ff\u0900-\u097f]/.test(trimmed)) {
    return false;
  }
  const hyphens = (trimmed.match(/-/g) || []).length;
  if (hyphens >= 2) return true;
  return /[A-Z]{2,}[a-z]*-/.test(trimmed);
}

function looksLikeEnglishLine(text: string, language?: SupportedLanguage): boolean {
  const trimmed = text.trim().replace(/^English\s*:\s*/i, "");
  if (!trimmed) return false;
  if (looksLikePhoneticLine(trimmed)) return false;
  if (hasNativeScript("Japanese", trimmed) || hasNativeScript("Chinese", trimmed)) {
    return false;
  }
  if (hasNativeScript("Korean", trimmed) || hasNativeScript("Arabic", trimmed)) {
    return false;
  }
  if (hasNativeScript("Hindi", trimmed)) return false;

  if (/[āīūēōĀĪŪĒŌ]/.test(trimmed)) return false;

  const words = trimmed.split(/\s+/).filter(Boolean);
  const functionHits = trimmed.match(ENGLISH_FUNCTION_WORDS)?.length ?? 0;
  const marker = language ? romanizationMarker(language) : null;

  if (
    /^(hello|hi|hey|welcome|thanks|thank you|please|sorry|yes|no|great|nice|my name)\b/i.test(
      trimmed,
    )
  ) {
    return true;
  }
  // English prose wins even if Polly/Buli/Polli appears in the line
  if (functionHits >= 2 && words.length >= 3) return true;
  if (marker?.test(trimmed)) return false;
  if (ENGLISH_STARTERS.test(trimmed) && functionHits >= 1) return true;
  if (
    /^[A-Za-z][A-Za-z0-9 ,'’?.!-]*[.?!]?$/.test(trimmed) &&
    words.length >= 3 &&
    functionHits >= 1
  ) {
    return true;
  }
  return false;
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
      (looksLikeRomanization(mixed[2]!, language) || isLatinLine(mixed[2]!))
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

    if (hasNativeScript(language, line) && next && !hasNativeScript(language, next) && isLatinLine(next)) {
      const nextIsEnglish = looksLikeEnglishLine(next, language);
      const nextIsRoma = !nextIsEnglish;
      const englishFromThird =
        nextIsRoma && third && looksLikeEnglishLine(third, language)
          ? third.replace(/^English\s*:\s*/i, "")
          : "";
      const englishFromNext = nextIsEnglish ? next.replace(/^English\s*:\s*/i, "") : "";
      blocks.push({
        native: line,
        romanization: nextIsRoma ? next : "",
        english: englishFromThird || englishFromNext,
      });
      if (englishFromThird) i += 2;
      else i += 1;
      continue;
    }

    if (hasNativeScript(language, line)) {
      const english =
        next && looksLikeEnglishLine(next, language)
          ? next.replace(/^English\s*:\s*/i, "")
          : "";
      blocks.push({
        native: line,
        romanization: "",
        english,
      });
      if (english) i += 1;
    } else if (looksLikeRomanization(line, language)) {
      blocks.push({ native: "", romanization: line });
    } else if (looksLikeEnglishLine(line, language)) {
      blocks.push({
        native: "",
        romanization: "",
        english: line.replace(/^English\s*:\s*/i, ""),
      });
    } else if (isLatinLine(line)) {
      // Unknown latin under a non-Latin chat: treat as romanization, never English
      blocks.push({ native: "", romanization: line });
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
  return lines.filter(
    (line) =>
      looksLikeEnglishLine(line, language) || looksLikePhoneticLine(line),
  );
}

/** Remove English gloss / extra phonetic lines when the learner turned help off. */
export function stripEnglishLines(
  content: string,
  language: SupportedLanguage,
): string {
  const lines = content
    .split(/\r?\n/)
    .map((line) => cleanLine(line))
    .filter(Boolean);

  if (NON_LATIN_LANGUAGES.includes(language)) {
    return lines
      .filter((line) => !looksLikeEnglishLine(line, language))
      .join("\n");
  }

  const kept: string[] = [];
  for (const line of lines) {
    if (
      kept.length > 0 &&
      (looksLikeEnglishLine(line, language) || looksLikePhoneticLine(line))
    ) {
      continue;
    }
    kept.push(line);
  }
  return kept.join("\n");
}

export function stripCorrectionArtifacts(content: string): string {
  return content
    .replace(/<<<\s*CORRECTION\s*>>>[\s\S]*?(<<<\s*END\s*>>>|$)/gi, "")
    .replace(/<<<\s*END\s*>>>/gi, "")
    .replace(/\n?\s*\{\s*"\s*encourage\s*"\s*:[\s\S]*$/i, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function visibleDialogueContent(
  content: string,
  language: SupportedLanguage,
  showEnglish: boolean,
): string {
  const cleaned = stripCorrectionArtifacts(content);
  if (showEnglish) return cleaned;
  return stripEnglishLines(cleaned, language);
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
