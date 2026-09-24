import type { Request, Response } from "express";
import { learningDnaService } from "../services/learningDnaService.js";
import { progressService } from "../services/progressService.js";

export const learningController = {
  async getProfile(req: Request, res: Response) {
    const userId = (req as Request & { user: { id: string } }).user.id;
    const profile = await learningDnaService.getPublicProfile(userId);
    res.json({ success: true, profile });
  },

  async getProgress(req: Request, res: Response) {
    const userId = (req as Request & { user: { id: string } }).user.id;
    const dashboard = await progressService.getDashboard(userId);
    res.json({ success: true, ...dashboard });
  },

  async getWeeklyInsights(req: Request, res: Response) {
    const userId = (req as Request & { user: { id: string } }).user.id;
    const insights = await progressService.getWeeklyInsights(userId);
    res.json({ success: true, insights });
  },
};
