import { Router } from "express";
import { settingsController } from "../controllers/settingsController.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";

export const settingsRoutes = Router();

settingsRoutes.use(requireAuth);
settingsRoutes.get("/", asyncHandler(settingsController.get));
settingsRoutes.patch("/", asyncHandler(settingsController.update));
settingsRoutes.post(
  "/onboarding",
  asyncHandler(settingsController.completeOnboarding),
);
