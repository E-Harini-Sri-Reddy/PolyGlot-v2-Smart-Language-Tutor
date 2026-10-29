import { apiFetch } from "./api";
import type { PublicUser } from "../types";

export const RESET_ACCOUNT_CONFIRMATION = "Reset account";
export const DELETE_ACCOUNT_CONFIRMATION = "Delete account";
export const DELETE_SNAPSHOT_CONFIRMATION = "Delete snapshot";

export type AccountSnapshotSummary = {
  id: string;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
};

type ReauthBody = {
  confirmation?: string;
  password?: string;
};

export async function deleteAccount(input: ReauthBody) {
  return apiFetch<{ success: boolean; purgeAt: string }>("/api/account/delete", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function resetAccount(input: ReauthBody) {
  return apiFetch<{
    success: boolean;
    user: PublicUser;
    snapshot: AccountSnapshotSummary;
  }>("/api/account/reset", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function listAccountSnapshots() {
  return apiFetch<{ success: boolean; snapshots: AccountSnapshotSummary[] }>(
    "/api/account/snapshots",
  );
}

export async function restoreAccountSnapshot(snapshotId: string, input: ReauthBody = {}) {
  return apiFetch<{ success: boolean; user: PublicUser }>(
    `/api/account/snapshots/${snapshotId}/restore`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export async function deleteAccountSnapshot(snapshotId: string, input: ReauthBody) {
  return apiFetch<{ success: boolean }>(`/api/account/snapshots/${snapshotId}`, {
    method: "DELETE",
    body: JSON.stringify(input),
  });
}
