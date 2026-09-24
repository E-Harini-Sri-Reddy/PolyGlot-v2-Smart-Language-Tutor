import type { Request, Response } from "express";
import { dictionaryService } from "../services/dictionaryService.js";
import {
  addDictionarySchema,
  reviewDictionarySchema,
  saveFromContextSchema,
  updateDictionarySchema,
} from "../validators/dictionaryValidators.js";

export const dictionaryController = {
  async list(req: Request, res: Response) {
    const userId = (req as Request & { user: { id: string } }).user.id;
    const entries = await dictionaryService.list(userId, {
      language: typeof req.query.language === "string" ? req.query.language : undefined,
      favorite: req.query.favorite === "true",
      needsReview: req.query.needsReview === "true",
      search: typeof req.query.search === "string" ? req.query.search : undefined,
    });
    res.json({ success: true, entries });
  },

  async create(req: Request, res: Response) {
    const userId = (req as Request & { user: { id: string } }).user.id;
    const body = addDictionarySchema.parse(req.body);
    const result = await dictionaryService.addWord(userId, body);
    res.status(result.created ? 201 : 200).json({
      success: true,
      created: result.created,
      entry: result.entry,
    });
  },

  async saveFromContext(req: Request, res: Response) {
    const userId = (req as Request & { user: { id: string } }).user.id;
    const body = saveFromContextSchema.parse(req.body);
    const result = await dictionaryService.saveFromContext(userId, body);
    res.status(result.created ? 201 : 200).json({
      success: true,
      created: result.created,
      entry: result.entry,
    });
  },

  async update(req: Request, res: Response) {
    const userId = (req as Request & { user: { id: string } }).user.id;
    const body = updateDictionarySchema.parse(req.body);
    const entry = await dictionaryService.updateEntry(
      userId,
      String(req.params.id),
      body,
    );
    res.json({ success: true, entry });
  },

  async review(req: Request, res: Response) {
    const userId = (req as Request & { user: { id: string } }).user.id;
    const body = reviewDictionarySchema.parse(req.body);
    const entry = await dictionaryService.markReviewed(
      userId,
      String(req.params.id),
      body.remembered,
    );
    res.json({ success: true, entry });
  },

  async remove(req: Request, res: Response) {
    const userId = (req as Request & { user: { id: string } }).user.id;
    await dictionaryService.remove(userId, String(req.params.id));
    res.json({ success: true });
  },
};
