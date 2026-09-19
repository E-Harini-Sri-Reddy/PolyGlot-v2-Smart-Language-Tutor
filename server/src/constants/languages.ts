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

export const NON_LATIN_LANGUAGES: SupportedLanguage[] = [
  "Japanese",
  "Chinese",
  "Hindi",
  "Korean",
  "Arabic",
];

export const NATIVE_LANGUAGE = "English" as const;
