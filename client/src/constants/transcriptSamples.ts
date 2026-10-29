import { type SupportedLanguage } from "./languages";

export type TranscriptSample = {
  native: string;
  transcript: string;
};

export const WELCOME_SAMPLES: Record<SupportedLanguage, TranscriptSample> = {
  Japanese: {
    native: "こんにちは！ ポリグロット へようこそ！",
    transcript: "Kon'nichiwa! porigurotto (PolyGlot) e yōkoso!",
  },
  Korean: {
    native: "안녕하세요! 폴리글롯에 오신 것을 환영해요!",
    transcript: "Annyeonghaseyo! Polligeullot-e osin geoseul hwanyeonghaeyo!",
  },
  Hindi: {
    native: "नमस्ते! पॉलीग्लॉट में आपका स्वागत है!",
    transcript: "Namaste! Pollyglot mein aapka swagat hai!",
  },
  Chinese: {
    native: "你好！欢迎来到 PolyGlot！",
    transcript: "Nǐ hǎo! Huānyíng lái dào PolyGlot!",
  },
  Arabic: {
    native: "مرحبًا! أهلًا بك في بوليغلوت!",
    transcript: "Marhaban! Ahlan bika fi PolyGlot!",
  },
  Spanish: {
    native: "¡Hola! ¡Bienvenido a PolyGlot!",
    transcript: "",
  },
  French: {
    native: "Bonjour ! Bienvenue sur PolyGlot !",
    transcript: "",
  },
  German: {
    native: "Hallo! Willkommen bei PolyGlot!",
    transcript: "",
  },
  English: {
    native: "Hello! Welcome to PolyGlot!",
    transcript: "",
  },
};

export function welcomeSample(language: SupportedLanguage): TranscriptSample {
  return WELCOME_SAMPLES[language] || WELCOME_SAMPLES.Spanish;
}
