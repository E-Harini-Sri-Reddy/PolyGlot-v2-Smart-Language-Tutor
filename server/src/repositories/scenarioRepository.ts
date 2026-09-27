import { Scenario, type ScenarioCreateInput } from "../models/Scenario.js";
import {
  ScenarioHistory,
  type ScenarioHistoryCreateInput,
} from "../models/ScenarioHistory.js";

export const scenarioRepository = {
  countPresets() {
    return Scenario.countDocuments({ isPreset: true });
  },

  insertMany(scenarios: ScenarioCreateInput[]) {
    return Scenario.insertMany(scenarios);
  },

  listPresets(filters: { difficulty?: string; category?: string } = {}) {
    const query: Record<string, unknown> = { isPreset: true };
    if (filters.difficulty) query.difficulty = filters.difficulty;
    if (filters.category) query.category = filters.category;
    return Scenario.find(query).sort({ category: 1, title: 1 });
  },

  findById(id: string) {
    return Scenario.findById(id);
  },

  create(data: ScenarioCreateInput) {
    return Scenario.create(data);
  },
};

export const scenarioHistoryRepository = {
  create(data: ScenarioHistoryCreateInput) {
    return ScenarioHistory.create(data);
  },

  listForUser(userId: string, limit = 20) {
    return ScenarioHistory.find({ userId })
      .sort({ completedAt: -1 })
      .limit(limit)
      .populate("scenarioId");
  },

  deleteByConversation(conversationId: string) {
    return ScenarioHistory.deleteMany({ conversationId });
  },
};
