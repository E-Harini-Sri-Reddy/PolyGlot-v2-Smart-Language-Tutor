import type { Request, Response } from "express";
import { settingsService } from "../services/settingsService.js";
import {
  completeOnboardingSchema,
  updateSettingsSchema,
} from "../validators/settingsValidators.js";

export const settingsController = {
  async get(req: Request, res: Response) {
    const userId = (req as Request & { user: { id: string } }).user.id;
    const data = await settingsService.getSettings(userId);
    res.json({ success: true, ...data });
  },

  async update(req: Request, res: Response) {
    const userId = (req as Request & { user: { id: string } }).user.id;
    const body = updateSettingsSchema.parse(req.body);
    const settings = await settingsService.updateSettings(userId, body);
    res.json({ success: true, settings });
  },

  async completeOnboarding(req: Request, res: Response) {
    const userId = (req as Request & { user: { id: string } }).user.id;
    const body = completeOnboardingSchema.parse(req.body);
    const data = await settingsService.completeOnboarding(userId, body);
    res.json({ success: true, ...data });
  },
};
