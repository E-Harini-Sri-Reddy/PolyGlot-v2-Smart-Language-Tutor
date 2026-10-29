import bcrypt from "bcryptjs";
import { describe, expect, it } from "vitest";
import { AppError } from "./errors.js";
import { assertPasswordReauth } from "./reauth.js";

describe("assertPasswordReauth", () => {
  it("skips Google-only accounts", async () => {
    await expect(assertPasswordReauth({ passwordHash: null }, undefined)).resolves.toBeUndefined();
  });

  it("requires the current password when the account has one", async () => {
    const passwordHash = await bcrypt.hash("correct-horse", 4);
    await expect(assertPasswordReauth({ passwordHash }, undefined)).rejects.toMatchObject({
      code: "REAUTH_REQUIRED",
    });
    await expect(assertPasswordReauth({ passwordHash }, "wrong")).rejects.toBeInstanceOf(AppError);
    await expect(assertPasswordReauth({ passwordHash }, "correct-horse")).resolves.toBeUndefined();
  });
});
