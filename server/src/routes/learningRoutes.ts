import { Router } from "express";
import { learningController } from "../controllers/learningController.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";

export const learningRoutes = Router();

learningRoutes.use(requireAuth);
learningRoutes.get("/profile", asyncHandler(learningController.getProfile));
learningRoutes.get("/progress", asyncHandler(learningController.getProgress));
learningRoutes.get(
  "/weekly-insights",
  asyncHandler(learningController.getWeeklyInsights),
);
