import {
  DictionaryEntry,
  type DictionaryCreateInput,
  type DictionaryDocument,
} from "../models/DictionaryEntry.js";

export const dictionaryRepository = {
  create(data: DictionaryCreateInput) {
    return DictionaryEntry.create(data);
  },

  findByUserWord(userId: string, language: string, word: string) {
    const trimmed = word.trim().replace(/\|/g, "");
    return DictionaryEntry.findOne({
      userId,
      language,
      $or: [{ word: trimmed }, { word: trimmed.toLowerCase() }],
    });
  },

  listForUser(
    userId: string,
    filters: {
      language?: string;
      favorite?: boolean;
      needsReview?: boolean;
      search?: string;
      limit?: number;
    } = {},
  ) {
    const query: Record<string, unknown> = { userId };
    if (filters.language) query.language = filters.language;
    if (filters.favorite) query.favorite = true;
    if (filters.needsReview) {
      query.nextReview = { $lte: new Date() };
    }
    if (filters.search) {
      query.$or = [
        { word: { $regex: filters.search, $options: "i" } },
        { meaning: { $regex: filters.search, $options: "i" } },
      ];
    }

    return DictionaryEntry.find(query)
      .sort({ updatedAt: -1 })
      .limit(filters.limit ?? 100);
  },

  listLowMastery(userId: string, language: string, limit = 8) {
    return DictionaryEntry.find({ userId, language })
      .sort({ masteryScore: 1, updatedAt: -1 })
      .limit(limit);
  },

  async save(entry: DictionaryDocument) {
    return entry.save();
  },

  findByIdForUser(id: string, userId: string) {
    return DictionaryEntry.findOne({ _id: id, userId });
  },

  deleteForUser(id: string, userId: string) {
    return DictionaryEntry.findOneAndDelete({ _id: id, userId });
  },

  deletePlaceholderMeanings(userId: string) {
    return DictionaryEntry.deleteMany({
      userId,
      meaning: {
        $regex: /^review from conversation summary$/i,
      },
    });
  },
};
