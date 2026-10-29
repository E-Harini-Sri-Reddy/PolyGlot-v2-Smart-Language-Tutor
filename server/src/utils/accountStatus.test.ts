import { describe, expect, it } from "vitest";
import { AppError } from "./errors.js";
import { assertAccountActive, isPendingDeletion } from "./accountStatus.js";

describe("account deletion status", () => {
  it("treats missing status as active", () => {
    expect(isPendingDeletion({})).toBe(false);
    expect(() => assertAccountActive({})).not.toThrow();
  });

  it("blocks pending accounts and exposes a purge date", () => {
    const purgeAt = new Date("2026-11-28T00:00:00.000Z");
    expect(isPendingDeletion({ accountStatus: "pending_deletion" })).toBe(true);
    try {
      assertAccountActive({
        accountStatus: "pending_deletion",
        deletionPurgeAt: purgeAt,
      });
      throw new Error("expected assertAccountActive to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      const err = error as AppError;
      expect(err.code).toBe("ACCOUNT_PENDING_DELETION");
      expect(err.statusCode).toBe(403);
      expect(err.details.purgeAt).toBe(purgeAt.toISOString());
    }
  });
});
