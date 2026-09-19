import type { SupportedLanguage } from "../constants/languages";
import { SPEECH_LANG_MAP } from "../constants/languages";

export function cleanSpeechText(text: string): string {
  return text
    .replace(/<<<CORRECTION>>>[\s\S]*?<<<END>>>/gi, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/[#*_`]/g, "")
    .trim();
}

export function speakText(text: string, language: SupportedLanguage) {
  if (!text || typeof window === "undefined" || !window.speechSynthesis) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(cleanSpeechText(text));
  utterance.rate = 0.9;
  utterance.pitch = 1;
  utterance.lang = SPEECH_LANG_MAP[language] || "en-US";
  window.speechSynthesis.speak(utterance);
}
