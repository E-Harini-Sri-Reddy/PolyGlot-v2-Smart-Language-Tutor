import type { Request, Response } from "express";
import { z } from "zod";
import { quizService } from "../services/quizService.js";
import { SUPPORTED_LANGUAGES } from "../constants/languages.js";

const generateSchema = z.object({
  language: z.enum(SUPPORTED_LANGUAGES),
  count: z.number().int().min(3).max(10).optional(),
});

const submitSchema = z.object({
  answers: z.array(z.string()).min(1),
});

export const quizController = {
  async generate(req: Request, res: Response) {
    const userId = (req as Request & { user: { id: string } }).user.id;
    const body = generateSchema.parse(req.body);
    const quiz = await quizService.generate(userId, body.language, body.count ?? 5);
    res.status(201).json({
      success: true,
      quiz: {
        id: quiz._id.toString(),
        language: quiz.language,
        topic: quiz.topic,
        total: quiz.total,
        questions: quiz.questions.map((question) => ({
          type: question.type,
          prompt: question.prompt,
          options: question.options,
          // Do not leak answers before submission
        })),
      },
    });
  },

  async submit(req: Request, res: Response) {
    const userId = (req as Request & { user: { id: string } }).user.id;
    const body = submitSchema.parse(req.body);
    const result = await quizService.submit(
      userId,
      String(req.params.id),
      body.answers,
    );
    res.json({ success: true, ...result });
  },

  async list(req: Request, res: Response) {
    const userId = (req as Request & { user: { id: string } }).user.id;
    const quizzes = await quizService.list(userId);
    res.json({ success: true, quizzes });
  },

  async get(req: Request, res: Response) {
    const userId = (req as Request & { user: { id: string } }).user.id;
    const quiz = await quizService.get(userId, String(req.params.id));
    res.json({ success: true, quiz });
  },

  async retake(req: Request, res: Response) {
    const userId = (req as Request & { user: { id: string } }).user.id;
    const quiz = await quizService.retake(userId, String(req.params.id));
    res.status(201).json({
      success: true,
      quiz: {
        id: quiz._id.toString(),
        language: quiz.language,
        topic: quiz.topic,
        total: quiz.total,
        questions: quiz.questions.map((question) => ({
          type: question.type,
          prompt: question.prompt,
          options: question.options,
        })),
      },
    });
  },
};
