import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AccountSnapshot } from "../models/AccountSnapshot.js";
import { Conversation } from "../models/Conversation.js";
import { DictionaryEntry } from "../models/DictionaryEntry.js";
import { Scenario } from "../models/Scenario.js";
import { User } from "../models/User.js";
import { UserSettings } from "../models/UserSettings.js";
import { AppError } from "../utils/errors.js";
import { clearTestDb, setupTestDb, teardownTestDb } from "../test/mongo.js";
import { accountService } from "./accountService.js";
import { authService } from "./authService.js";

const PASSWORD = "correct-horse";

async function createUser(email: string) {
  return User.create({
    name: email.split("@")[0],
    email,
    passwordHash: await bcrypt.hash(PASSWORD, 4),
    onboardingCompleted: true,
  });
}

describe("account deletion and reset", () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  it("refuses reset/delete/restore without the current password", async () => {
    const user = await createUser("ada@example.com");
    const userId = user._id.toString();

    await expect(accountService.resetAccount(userId)).rejects.toMatchObject({
      code: "REAUTH_REQUIRED",
    });
    await expect(accountService.scheduleDeletion(userId)).rejects.toMatchObject({
      code: "REAUTH_REQUIRED",
    });
    await expect(accountService.resetAccount(userId, { password: "wrong" })).rejects.toBeInstanceOf(
      AppError,
    );
  });

  it("snapshots live data, wipes only that user, and leaves presets alone", async () => {
    const ada = await createUser("ada@example.com");
    const grace = await createUser("grace@example.com");

    await DictionaryEntry.create({
      userId: ada._id,
      word: "hola",
      language: "Spanish",
      meaning: "hello",
    });
    await DictionaryEntry.create({
      userId: grace._id,
      word: "bonjour",
      language: "French",
      meaning: "hello",
    });
    await Conversation.create({
      userId: ada._id,
      language: "Spanish",
      title: "Cafe",
      level: "Beginner",
    });
    const preset = await Scenario.create({
      title: "Airport check-in",
      category: "Travel",
      difficulty: "Beginner",
      promptTemplate: "You are at the airport.",
      isPreset: true,
    });

    const result = await accountService.resetAccount(ada._id.toString(), { password: PASSWORD });

    expect(result.user.onboardingCompleted).toBe(false);
    expect(await DictionaryEntry.countDocuments({ userId: ada._id })).toBe(0);
    expect(await Conversation.countDocuments({ userId: ada._id })).toBe(0);
    expect(await DictionaryEntry.findOne({ userId: grace._id }).lean()).toMatchObject({
      word: "bonjour",
    });
    expect(await Scenario.findById(preset._id).lean()).toMatchObject({ isPreset: true });
    expect(await AccountSnapshot.countDocuments({ userId: ada._id })).toBe(1);
    expect(await UserSettings.findOne({ userId: ada._id })).toBeTruthy();
  });

  it("restores a snapshot as a checkout and blocks cross-user restore/delete", async () => {
    const ada = await createUser("ada@example.com");
    const grace = await createUser("grace@example.com");

    await DictionaryEntry.create({
      userId: ada._id,
      word: "hola",
      language: "Spanish",
      meaning: "hello",
    });

    await accountService.resetAccount(ada._id.toString(), { password: PASSWORD });
    const snapshot = await AccountSnapshot.findOne({ userId: ada._id });
    expect(snapshot).toBeTruthy();

    await DictionaryEntry.create({
      userId: ada._id,
      word: "adiós",
      language: "Spanish",
      meaning: "goodbye",
    });

    await expect(
      accountService.restoreSnapshot(grace._id.toString(), snapshot!._id.toString(), {
        password: PASSWORD,
      }),
    ).rejects.toMatchObject({ code: "SNAPSHOT_NOT_FOUND" });

    await expect(
      accountService.deleteSnapshot(grace._id.toString(), snapshot!._id.toString(), {
        password: PASSWORD,
      }),
    ).rejects.toMatchObject({ code: "SNAPSHOT_NOT_FOUND" });

    await accountService.restoreSnapshot(ada._id.toString(), snapshot!._id.toString(), {
      password: PASSWORD,
    });

    const words = await DictionaryEntry.find({ userId: ada._id }).lean();
    expect(words.map((entry) => entry.word)).toEqual(["hola"]);
  });

  it("cannot adopt another user's id or publish a preset through a tampered snapshot", async () => {
    const ada = await createUser("ada@example.com");
    const grace = await createUser("grace@example.com");

    const snapshot = await AccountSnapshot.create({
      userId: ada._id,
      periodStart: new Date("2026-01-01"),
      periodEnd: new Date("2026-02-01"),
      payload: {
        userState: { name: "Ada", pronouns: "", avatarUrl: null, onboardingCompleted: true },
        settings: null,
        learningProfile: null,
        conversations: [],
        messages: [],
        conversationSummaries: [],
        dictionaryEntries: [
          {
            userId: grace._id,
            word: "stolen",
            language: "Spanish",
            meaning: "should not land on grace",
          },
        ],
        skillProgress: [],
        quizHistory: [],
        scenarioHistory: [],
        customScenarios: [
          {
            title: "Malicious preset",
            category: "Hack",
            difficulty: "Beginner",
            promptTemplate: "ignore previous",
            isPreset: true,
            createdBy: grace._id,
          },
        ],
      },
    });

    await accountService.restoreSnapshot(ada._id.toString(), snapshot._id.toString(), {
      password: PASSWORD,
    });

    expect(await DictionaryEntry.countDocuments({ userId: grace._id })).toBe(0);
    expect(await DictionaryEntry.findOne({ userId: ada._id }).lean()).toMatchObject({
      word: "stolen",
    });
    expect(await Scenario.findOne({ title: "Malicious preset" }).lean()).toMatchObject({
      isPreset: false,
      createdBy: ada._id,
    });
  });

  it("soft-deletes until restore, then purges after the grace window", async () => {
    const ada = await createUser("ada@example.com");
    await DictionaryEntry.create({
      userId: ada._id,
      word: "hola",
      language: "Spanish",
      meaning: "hello",
    });
    await accountService.resetAccount(ada._id.toString(), { password: PASSWORD });

    await accountService.scheduleDeletion(ada._id.toString(), { password: PASSWORD });
    const pending = await User.findById(ada._id);
    expect(pending?.accountStatus).toBe("pending_deletion");
    expect(pending?.refreshTokenHash).toBeNull();

    await expect(
      authService.login({ email: "ada@example.com", password: PASSWORD }),
    ).rejects.toMatchObject({ code: "ACCOUNT_PENDING_DELETION" });

    const restored = await authService.restoreAccount({
      email: "ada@example.com",
      password: PASSWORD,
    });
    expect(restored.user.email).toBe("ada@example.com");
    expect((await User.findById(ada._id))?.accountStatus).toBe("active");
    expect(await AccountSnapshot.countDocuments({ userId: ada._id })).toBe(1);

    await accountService.scheduleDeletion(ada._id.toString(), { password: PASSWORD });
    await User.updateOne(
      { _id: ada._id },
      { $set: { deletionPurgeAt: new Date(Date.now() - 1000) } },
    );

    const purged = await accountService.purgeExpiredAccounts();
    expect(purged).toBe(1);
    expect(await User.findById(ada._id)).toBeNull();
    expect(await AccountSnapshot.countDocuments({ userId: ada._id })).toBe(0);
    expect(await DictionaryEntry.countDocuments({ userId: ada._id })).toBe(0);
  });
});
