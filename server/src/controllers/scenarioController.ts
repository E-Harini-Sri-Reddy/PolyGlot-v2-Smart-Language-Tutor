import type { Request, Response } from "express";
import { z } from "zod";
import { scenarioService } from "../services/scenarioService.js";
import {
  PROFICIENCY_LEVELS,
  SUPPORTED_LANGUAGES,
} from "../constants/languages.js";

const customScenarioSchema = z.object({
  prompt: z.string().trim().min(3).max(500),
  language: z.enum(SUPPORTED_LANGUAGES),
  level: z.enum(PROFICIENCY_LEVELS),
});

export const scenarioController = {
  async list(req: Request, res: Response) {
    const scenarios = await scenarioService.listPresets({
      difficulty:
        typeof req.query.difficulty === "string" ? req.query.difficulty : undefined,
      category:
        typeof req.query.category === "string" ? req.query.category : undefined,
    });
    res.json({ success: true, scenarios });
  },

  async get(req: Request, res: Response) {
    const scenario = await scenarioService.getById(String(req.params.id));
    res.json({ success: true, scenario });
  },

  async createCustom(req: Request, res: Response) {
    const userId = (req as Request & { user: { id: string } }).user.id;
    const body = customScenarioSchema.parse(req.body);
    const scenario = await scenarioService.createCustom({
      userId,
      prompt: body.prompt,
      language: body.language,
      level: body.level,
    });
    res.status(201).json({ success: true, scenario });
  },

  async history(req: Request, res: Response) {
    const userId = (req as Request & { user: { id: string } }).user.id;
    const history = await scenarioService.listHistory(userId);
    res.json({ success: true, history });
  },
};
