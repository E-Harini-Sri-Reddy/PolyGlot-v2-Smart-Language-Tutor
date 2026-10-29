import type { AccountSnapshotPayload } from "../models/AccountSnapshot.js";
import { AppError } from "./errors.js";

export const MAX_SNAPSHOT_DOCS_PER_COLLECTION = 8000;
export const MAX_SNAPSHOT_BYTES = 10 * 1024 * 1024;

const SECRET_KEYS = new Set([
  "passwordHash",
  "refreshTokenHash",
  "passwordResetTokenHash",
  "passwordResetExpiresAt",
]);

function plainObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return { ...(value as Record<string, unknown>) };
}

export function sanitizeAvatarUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, 500);
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return trimmed;
  } catch {
    return null;
  }
}

function stripSecrets(doc: Record<string, unknown>) {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(doc)) {
    if (SECRET_KEYS.has(key) || key === "__proto__" || key === "constructor" || key === "prototype") {
      continue;
    }
    next[key] = value;
  }
  return next;
}

function bindOwner(
  doc: Record<string, unknown>,
  userId: string,
  extra?: (doc: Record<string, unknown>) => Record<string, unknown>,
) {
  const bound = stripSecrets({ ...doc, userId });
  return extra ? extra(bound) : bound;
}

function capOwnedArray(
  docs: unknown,
  userId: string,
  extra?: (doc: Record<string, unknown>) => Record<string, unknown>,
): Record<string, unknown>[] {
  if (!Array.isArray(docs)) return [];
  const owned: Record<string, unknown>[] = [];
  for (const item of docs.slice(0, MAX_SNAPSHOT_DOCS_PER_COLLECTION)) {
    const obj = plainObject(item);
    if (!obj) continue;
    owned.push(bindOwner(obj, userId, extra));
  }
  return owned;
}

export function sanitizeSnapshotPayload(
  payload: unknown,
  userId: string,
): AccountSnapshotPayload {
  const source = plainObject(payload);
  if (!source) {
    throw new AppError(400, "INVALID_SNAPSHOT", "Snapshot data is corrupted.");
  }

  const userStateRaw = plainObject(source.userState) ?? {};
  const settings = plainObject(source.settings);
  const learningProfile = plainObject(source.learningProfile);

  const sanitized: AccountSnapshotPayload = {
    userState: {
      name:
        typeof userStateRaw.name === "string"
          ? userStateRaw.name.trim().slice(0, 80)
          : "",
      pronouns:
        typeof userStateRaw.pronouns === "string"
          ? userStateRaw.pronouns.trim().slice(0, 40)
          : "",
      avatarUrl: sanitizeAvatarUrl(userStateRaw.avatarUrl),
      onboardingCompleted: Boolean(userStateRaw.onboardingCompleted),
    },
    settings: settings ? bindOwner(settings, userId) : null,
    learningProfile: learningProfile ? bindOwner(learningProfile, userId) : null,
    conversations: capOwnedArray(source.conversations, userId),
    messages: capOwnedArray(source.messages, userId),
    conversationSummaries: capOwnedArray(source.conversationSummaries, userId),
    dictionaryEntries: capOwnedArray(source.dictionaryEntries, userId),
    skillProgress: capOwnedArray(source.skillProgress, userId),
    quizHistory: capOwnedArray(source.quizHistory, userId),
    scenarioHistory: capOwnedArray(source.scenarioHistory, userId),
    customScenarios: capOwnedArray(source.customScenarios, userId, (doc) => ({
      ...doc,
      createdBy: userId,
      isPreset: false,
    })),
  };

  const bytes = Buffer.byteLength(JSON.stringify(sanitized), "utf8");
  if (bytes > MAX_SNAPSHOT_BYTES) {
    throw new AppError(
      413,
      "SNAPSHOT_TOO_LARGE",
      "This account has too much data to snapshot.",
    );
  }

  return sanitized;
}
