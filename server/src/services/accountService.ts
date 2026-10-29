import { AccountSnapshot } from "../models/AccountSnapshot.js";
import { userRepository } from "../repositories/userRepository.js";
import { AppError } from "../utils/errors.js";
import { assertPasswordReauth } from "../utils/reauth.js";
import { sanitizeSnapshotPayload } from "../utils/snapshotSanitize.js";
import { accountDataService } from "./accountDataService.js";
import type { UserDocument } from "../models/User.js";

export const ACCOUNT_DELETION_GRACE_MS = 30 * 24 * 60 * 60 * 1000;

function publicUser(user: UserDocument) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl ?? null,
    onboardingCompleted: Boolean(user.onboardingCompleted),
    pronouns: user.pronouns ?? "",
    hasPassword: Boolean(user.passwordHash),
  };
}

function snapshotSummary(snapshot: {
  _id: { toString(): string };
  periodStart: Date;
  periodEnd: Date;
  createdAt?: Date;
}) {
  return {
    id: snapshot._id.toString(),
    periodStart: snapshot.periodStart,
    periodEnd: snapshot.periodEnd,
    createdAt: snapshot.createdAt ?? snapshot.periodEnd,
  };
}

async function requireUser(userId: string) {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new AppError(404, "USER_NOT_FOUND", "User not found.");
  }
  return user;
}

type ReauthInput = {
  password?: string;
};

export const accountService = {
  async scheduleDeletion(userId: string, input: ReauthInput = {}) {
    const user = await requireUser(userId);
    await assertPasswordReauth(user, input.password);
    const now = new Date();
    user.accountStatus = "pending_deletion";
    user.deletionScheduledAt = now;
    user.deletionPurgeAt = new Date(now.getTime() + ACCOUNT_DELETION_GRACE_MS);
    user.refreshTokenHash = null;
    await userRepository.save(user);
    return {
      purgeAt: user.deletionPurgeAt,
    };
  },

  async listSnapshots(userId: string) {
    await requireUser(userId);
    const snapshots = await AccountSnapshot.find({ userId })
      .sort({ periodEnd: -1 })
      .select("periodStart periodEnd createdAt")
      .lean();
    return snapshots.map((snapshot) => snapshotSummary(snapshot));
  },

  async resetAccount(userId: string, input: ReauthInput = {}) {
    const user = await requireUser(userId);
    await assertPasswordReauth(user, input.password);
    const now = new Date();
    const payload = sanitizeSnapshotPayload(
      await accountDataService.collectLive(user),
      user._id.toString(),
    );
    const periodStart = user.livePeriodStart ?? user.createdAt ?? now;

    const snapshot = await AccountSnapshot.create({
      userId: user._id,
      periodStart,
      periodEnd: now,
      payload,
    });

    await accountDataService.wipeLive(userId);
    await accountDataService.seedFresh(userId);

    user.onboardingCompleted = false;
    user.livePeriodStart = now;
    await userRepository.save(user);

    return {
      user: publicUser(user),
      snapshot: snapshotSummary(snapshot),
    };
  },

  async restoreSnapshot(userId: string, snapshotId: string, input: ReauthInput = {}) {
    const user = await requireUser(userId);
    await assertPasswordReauth(user, input.password);
    const snapshot = await AccountSnapshot.findOne({ _id: snapshotId, userId });
    if (!snapshot) {
      throw new AppError(404, "SNAPSHOT_NOT_FOUND", "That data snapshot was not found.");
    }

    const payload = sanitizeSnapshotPayload(snapshot.payload, user._id.toString());
    await accountDataService.restorePayload(user, payload);
    const refreshed = await requireUser(userId);
    refreshed.livePeriodStart = new Date();
    await userRepository.save(refreshed);

    return { user: publicUser(refreshed) };
  },

  async deleteSnapshot(userId: string, snapshotId: string, input: ReauthInput = {}) {
    const user = await requireUser(userId);
    await assertPasswordReauth(user, input.password);
    const result = await AccountSnapshot.deleteOne({ _id: snapshotId, userId });
    if (result.deletedCount === 0) {
      throw new AppError(404, "SNAPSHOT_NOT_FOUND", "That data snapshot was not found.");
    }
  },

  async purgeExpiredAccounts() {
    const due = await userRepository.findPendingDeletionDue();
    let purged = 0;
    for (const user of due) {
      try {
        await accountDataService.purgeAccount(user);
        purged += 1;
      } catch (error) {
        console.error(`Failed to purge account ${user._id.toString()}:`, error);
      }
    }
    return purged;
  },
};
