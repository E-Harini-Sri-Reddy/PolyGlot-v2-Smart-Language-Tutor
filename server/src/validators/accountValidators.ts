import { z } from "zod";

export const RESET_ACCOUNT_CONFIRMATION = "Reset account";
export const DELETE_ACCOUNT_CONFIRMATION = "Delete account";
export const DELETE_SNAPSHOT_CONFIRMATION = "Delete snapshot";

const optionalPassword = z.string().min(1).max(128).optional();

export const resetAccountSchema = z.object({
  confirmation: z.literal(RESET_ACCOUNT_CONFIRMATION),
  password: optionalPassword,
});

export const deleteAccountSchema = z.object({
  confirmation: z.literal(DELETE_ACCOUNT_CONFIRMATION),
  password: optionalPassword,
});

export const restoreSnapshotSchema = z.object({
  password: optionalPassword,
});

export const deleteSnapshotSchema = z.object({
  confirmation: z.literal(DELETE_SNAPSHOT_CONFIRMATION),
  password: optionalPassword,
});

export const snapshotIdSchema = z.object({
  snapshotId: z.string().regex(/^[a-fA-F0-9]{24}$/, "Invalid snapshot id."),
});
