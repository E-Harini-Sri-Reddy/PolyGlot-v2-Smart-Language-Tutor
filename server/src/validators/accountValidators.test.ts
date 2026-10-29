import { describe, expect, it } from "vitest";
import {
  DELETE_ACCOUNT_CONFIRMATION,
  DELETE_SNAPSHOT_CONFIRMATION,
  RESET_ACCOUNT_CONFIRMATION,
  deleteAccountSchema,
  deleteSnapshotSchema,
  resetAccountSchema,
  snapshotIdSchema,
} from "./accountValidators.js";

describe("account confirmation schemas", () => {
  it("requires the exact Reset account phrase", () => {
    expect(resetAccountSchema.safeParse({ confirmation: "reset account" }).success).toBe(
      false,
    );
    expect(
      resetAccountSchema.safeParse({
        confirmation: RESET_ACCOUNT_CONFIRMATION,
        password: "secret",
      }).success,
    ).toBe(true);
  });

  it("requires exact delete phrases", () => {
    expect(deleteAccountSchema.safeParse({ confirmation: "delete account" }).success).toBe(
      false,
    );
    expect(
      deleteAccountSchema.safeParse({ confirmation: DELETE_ACCOUNT_CONFIRMATION }).success,
    ).toBe(true);
    expect(
      deleteSnapshotSchema.safeParse({ confirmation: DELETE_SNAPSHOT_CONFIRMATION }).success,
    ).toBe(true);
  });

  it("rejects non-ObjectId snapshot ids", () => {
    expect(snapshotIdSchema.safeParse({ snapshotId: "../admin" }).success).toBe(false);
    expect(snapshotIdSchema.safeParse({ snapshotId: "64b0f0f0f0f0f0f0f0f0f0f0" }).success).toBe(
      true,
    );
  });
});
