import { Router } from "express";
import rateLimit from "express-rate-limit";
import { accountController } from "../controllers/accountController.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";

const accountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
});

export const accountRoutes = Router();

accountRoutes.use(requireAuth);

accountRoutes.post(
  "/delete",
  accountLimiter,
  asyncHandler(accountController.deleteAccount),
);
accountRoutes.post(
  "/reset",
  accountLimiter,
  asyncHandler(accountController.resetAccount),
);
accountRoutes.get("/snapshots", asyncHandler(accountController.listSnapshots));
accountRoutes.post(
  "/snapshots/:snapshotId/restore",
  accountLimiter,
  asyncHandler(accountController.restoreSnapshot),
);
accountRoutes.delete(
  "/snapshots/:snapshotId",
  accountLimiter,
  asyncHandler(accountController.deleteSnapshot),
);
