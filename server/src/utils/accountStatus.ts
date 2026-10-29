import { AppError } from "./errors.js";

export function isPendingDeletion(user: { accountStatus?: string | null }) {
  return user.accountStatus === "pending_deletion";
}

export function pendingDeletionError(user: { deletionPurgeAt?: Date | null }) {
  return new AppError(
    403,
    "ACCOUNT_PENDING_DELETION",
    "This account is scheduled for permanent deletion.",
    {
      purgeAt: user.deletionPurgeAt?.toISOString() ?? null,
    },
  );
}

export function assertAccountActive(user: {
  accountStatus?: string | null;
  deletionPurgeAt?: Date | null;
}) {
  if (isPendingDeletion(user)) {
    throw pendingDeletionError(user);
  }
}
