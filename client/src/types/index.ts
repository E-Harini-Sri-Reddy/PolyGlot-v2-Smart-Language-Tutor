export type PublicUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  onboardingCompleted: boolean;
  pronouns?: string;
};

export type TutorCorrection = {
  encourage: string;
  corrected: string;
  translation?: string;
  wordByWord?: Array<{ word: string; meaning: string }>;
  explain: string;
  why?: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt?: string;
  correction?: TutorCorrection | null;
  helpMode?: boolean;
  metadata?: {
    corrections?: TutorCorrection[];
    helpMode?: boolean;
  };
};

export type Conversation = {
  _id: string;
  title: string;
  language: string;
  level: string;
  scenarioText?: string;
  status: string;
  messageCount: number;
  createdAt?: string;
  updatedAt?: string;
};
