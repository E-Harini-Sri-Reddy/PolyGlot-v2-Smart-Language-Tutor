import { Router } from "express";
import rateLimit from "express-rate-limit";
import { quizController } from "../controllers/quizController.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";

const quizLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

export const quizRoutes = Router();

quizRoutes.use(requireAuth);
quizRoutes.get("/", asyncHandler(quizController.list));
quizRoutes.post("/generate", quizLimiter, asyncHandler(quizController.generate));
quizRoutes.get("/:id", asyncHandler(quizController.get));
quizRoutes.post("/:id/submit", asyncHandler(quizController.submit));
quizRoutes.post("/:id/retake", quizLimiter, asyncHandler(quizController.retake));
