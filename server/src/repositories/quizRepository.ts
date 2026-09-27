import { QuizHistory, type QuizHistoryCreateInput } from "../models/QuizHistory.js";

export const quizRepository = {
  create(data: QuizHistoryCreateInput) {
    return QuizHistory.create(data);
  },

  findByIdForUser(id: string, userId: string) {
    return QuizHistory.findOne({ _id: id, userId });
  },

  listForUser(userId: string, limit = 20) {
    return QuizHistory.find({ userId }).sort({ createdAt: -1 }).limit(limit);
  },
};
