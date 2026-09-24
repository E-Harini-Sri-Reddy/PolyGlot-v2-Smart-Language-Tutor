import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authController } from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
});

export const authRoutes = Router();

authRoutes.post("/register", authLimiter, asyncHandler(authController.register));
authRoutes.post("/login", authLimiter, asyncHandler(authController.login));
authRoutes.post("/google", authLimiter, asyncHandler(authController.google));
authRoutes.post("/refresh", asyncHandler(authController.refresh));
authRoutes.post("/logout", requireAuth, asyncHandler(authController.logout));
authRoutes.get("/me", requireAuth, asyncHandler(authController.me));
authRoutes.post(
  "/forgot-password",
  authLimiter,
  asyncHandler(authController.forgotPassword),
);
authRoutes.post(
  "/reset-password",
  authLimiter,
  asyncHandler(authController.resetPassword),
);
