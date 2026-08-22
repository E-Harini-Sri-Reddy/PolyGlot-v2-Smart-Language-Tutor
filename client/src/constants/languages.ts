export const SUPPORTED_LANGUAGES = [
  "Spanish",
  "French",
  "German",
  "Japanese",
  "Korean",
  "Chinese",
  "Hindi",
  "Arabic",
  "English",
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const PROFICIENCY_LEVELS = ["Beginner", "Intermediate", "Advanced"] as const;
export type ProficiencyLevel = (typeof PROFICIENCY_LEVELS)[number];

export const TUTOR_PERSONALITIES = [
  "Friendly Teacher",
  "Professional Teacher",
  "Funny Friend",
  "Native Speaker",
  "Socratic Teacher",
  "Strict Exam Coach",
] as const;
export type TutorPersonality = (typeof TUTOR_PERSONALITIES)[number];

export const LEARNING_GOALS = [
  "Travel",
  "Work",
  "School",
  "Exam",
  "Moving Abroad",
  "Fun",
  "Conversation",
  "Business",
] as const;

export const TOPIC_OPTIONS = [
  "Travel",
  "Food",
  "Technology",
  "Movies",
  "Business",
  "Anime",
  "Sports",
  "Music",
] as const;

export const NON_LATIN_LANGUAGES: SupportedLanguage[] = [
  "Japanese",
  "Chinese",
  "Hindi",
  "Korean",
  "Arabic",
];

export const SPEECH_LANG_MAP: Record<SupportedLanguage, string> = {
  Spanish: "es-ES",
  French: "fr-FR",
  German: "de-DE",
  Japanese: "ja-JP",
  Korean: "ko-KR",
  Chinese: "zh-CN",
  Hindi: "hi-IN",
  Arabic: "ar-SA",
  English: "en-US",
};
