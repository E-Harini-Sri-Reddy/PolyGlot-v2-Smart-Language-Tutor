import { AccountSnapshot, type AccountSnapshotPayload } from "../models/AccountSnapshot.js";
import { Conversation } from "../models/Conversation.js";
import { ConversationSummary } from "../models/ConversationSummary.js";
import { DictionaryEntry } from "../models/DictionaryEntry.js";
import { LearningProfile } from "../models/LearningProfile.js";
import { Message } from "../models/Message.js";
import { QuizHistory } from "../models/QuizHistory.js";
import { Scenario } from "../models/Scenario.js";
import { ScenarioHistory } from "../models/ScenarioHistory.js";
import { SkillProgress } from "../models/SkillProgress.js";
import { User, type UserDocument } from "../models/User.js";
import { UserSettings } from "../models/UserSettings.js";
import { sanitizeSnapshotPayload } from "../utils/snapshotSanitize.js";
import { learningDnaService } from "./learningDnaService.js";
import { userSettingsRepository } from "../repositories/userSettingsRepository.js";

function asRecords(docs: unknown[] | null | undefined): Record<string, unknown>[] {
  return (docs ?? []) as Record<string, unknown>[];
}

function asRecord(doc: unknown | null | undefined): Record<string, unknown> | null {
  return doc ? (doc as Record<string, unknown>) : null;
}

async function insertManySafe(
  model: { insertMany: (docs: never[], options?: { ordered?: boolean }) => Promise<unknown> },
  docs: unknown[] | null | undefined,
) {
  if (!docs || docs.length === 0) return;
  await model.insertMany(docs as never[], { ordered: false });
}

export const accountDataService = {
  async collectLive(user: UserDocument): Promise<AccountSnapshotPayload> {
    const userId = user._id;

    const [
      settings,
      learningProfile,
      conversations,
      messages,
      conversationSummaries,
      dictionaryEntries,
      skillProgress,
      quizHistory,
      scenarioHistory,
      customScenarios,
    ] = await Promise.all([
      UserSettings.findOne({ userId }).lean(),
      LearningProfile.findOne({ userId }).lean(),
      Conversation.find({ userId }).lean(),
      Message.find({ userId }).lean(),
      ConversationSummary.find({ userId }).lean(),
      DictionaryEntry.find({ userId }).lean(),
      SkillProgress.find({ userId }).lean(),
      QuizHistory.find({ userId }).lean(),
      ScenarioHistory.find({ userId }).lean(),
      Scenario.find({ createdBy: userId, isPreset: { $ne: true } }).lean(),
    ]);

    return sanitizeSnapshotPayload(
      {
        userState: {
          name: user.name,
          pronouns: user.pronouns ?? "",
          avatarUrl: user.avatarUrl ?? null,
          onboardingCompleted: Boolean(user.onboardingCompleted),
        },
        settings: asRecord(settings),
        learningProfile: asRecord(learningProfile),
        conversations: asRecords(conversations),
        messages: asRecords(messages),
        conversationSummaries: asRecords(conversationSummaries),
        dictionaryEntries: asRecords(dictionaryEntries),
        skillProgress: asRecords(skillProgress),
        quizHistory: asRecords(quizHistory),
        scenarioHistory: asRecords(scenarioHistory),
        customScenarios: asRecords(customScenarios),
      },
      user._id.toString(),
    );
  },

  async wipeLive(userId: string) {
    await Promise.all([
      UserSettings.deleteMany({ userId }),
      LearningProfile.deleteMany({ userId }),
      Conversation.deleteMany({ userId }),
      Message.deleteMany({ userId }),
      ConversationSummary.deleteMany({ userId }),
      DictionaryEntry.deleteMany({ userId }),
      SkillProgress.deleteMany({ userId }),
      QuizHistory.deleteMany({ userId }),
      ScenarioHistory.deleteMany({ userId }),
      Scenario.deleteMany({ createdBy: userId, isPreset: { $ne: true } }),
    ]);
  },

  async seedFresh(userId: string) {
    await userSettingsRepository.createForUser(userId);
    await learningDnaService.getOrCreate(userId);
  },

  async restorePayload(user: UserDocument, payload: AccountSnapshotPayload) {
    const userId = user._id.toString();
    const safePayload = sanitizeSnapshotPayload(payload, userId);
    await this.wipeLive(userId);

    await Promise.all([
      insertManySafe(UserSettings, safePayload.settings ? [safePayload.settings] : []),
      insertManySafe(
        LearningProfile,
        safePayload.learningProfile ? [safePayload.learningProfile] : [],
      ),
      insertManySafe(Conversation, safePayload.conversations),
      insertManySafe(Message, safePayload.messages),
      insertManySafe(ConversationSummary, safePayload.conversationSummaries),
      insertManySafe(DictionaryEntry, safePayload.dictionaryEntries),
      insertManySafe(SkillProgress, safePayload.skillProgress),
      insertManySafe(QuizHistory, safePayload.quizHistory),
      insertManySafe(ScenarioHistory, safePayload.scenarioHistory),
      insertManySafe(Scenario, safePayload.customScenarios),
    ]);

    if (safePayload.userState) {
      user.name = safePayload.userState.name || user.name;
      user.pronouns = safePayload.userState.pronouns ?? "";
      user.avatarUrl = safePayload.userState.avatarUrl ?? user.avatarUrl ?? null;
      user.onboardingCompleted = Boolean(safePayload.userState.onboardingCompleted);
      await user.save();
    }
  },

  async purgeAccount(user: UserDocument) {
    const userId = user._id.toString();
    await this.wipeLive(userId);
    await AccountSnapshot.deleteMany({ userId });
    await User.deleteOne({ _id: user._id });
  },
};
