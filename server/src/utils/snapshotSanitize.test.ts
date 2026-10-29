import { describe, expect, it } from "vitest";
import { AppError } from "./errors.js";
import { sanitizeAvatarUrl, sanitizeSnapshotPayload } from "./snapshotSanitize.js";

const USER_A = "64b0f0f0f0f0f0f0f0f0f0f0";
const USER_B = "64b0f0f0f0f0f0f0f0f0f0f1";

describe("sanitizeAvatarUrl", () => {
  it("allows http(s) URLs and rejects javascript URLs", () => {
    expect(sanitizeAvatarUrl("https://cdn.example/a.png")).toBe("https://cdn.example/a.png");
    expect(sanitizeAvatarUrl("javascript:alert(1)")).toBeNull();
    expect(sanitizeAvatarUrl("data:text/html,hi")).toBeNull();
  });
});

describe("sanitizeSnapshotPayload", () => {
  it("rebinds every document to the restoring user and strips secrets", () => {
    const sanitized = sanitizeSnapshotPayload(
      {
        userState: {
          name: "Ada",
          pronouns: "she/her",
          avatarUrl: "https://cdn.example/ada.png",
          onboardingCompleted: true,
          passwordHash: "stolen",
        },
        settings: { userId: USER_B, passwordHash: "nope", targetLanguage: "Hindi" },
        conversations: [{ userId: USER_B, title: "Chat", passwordHash: "x" }],
        messages: [{ userId: USER_B, content: "hola", refreshTokenHash: "tok" }],
        customScenarios: [
          { createdBy: USER_B, isPreset: true, title: "Fake preset", promptTemplate: "x" },
        ],
      },
      USER_A,
    );

    expect(sanitized.settings?.userId).toBe(USER_A);
    expect(sanitized.settings?.passwordHash).toBeUndefined();
    expect(sanitized.conversations[0]?.userId).toBe(USER_A);
    expect(sanitized.conversations[0]?.passwordHash).toBeUndefined();
    expect(sanitized.messages[0]?.userId).toBe(USER_A);
    expect(sanitized.messages[0]?.refreshTokenHash).toBeUndefined();
    expect(sanitized.customScenarios[0]?.createdBy).toBe(USER_A);
    expect(sanitized.customScenarios[0]?.isPreset).toBe(false);
    expect(sanitized.userState.name).toBe("Ada");
  });

  it("rejects corrupted payloads", () => {
    expect(() => sanitizeSnapshotPayload(null, USER_A)).toThrow(AppError);
    expect(() => sanitizeSnapshotPayload("nope", USER_A)).toThrow(AppError);
  });
});
