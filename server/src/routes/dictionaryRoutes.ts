import { Router } from "express";
import { dictionaryController } from "../controllers/dictionaryController.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";

export const dictionaryRoutes = Router();

dictionaryRoutes.use(requireAuth);
dictionaryRoutes.get("/", asyncHandler(dictionaryController.list));
dictionaryRoutes.post("/", asyncHandler(dictionaryController.create));
dictionaryRoutes.post(
  "/from-context",
  asyncHandler(dictionaryController.saveFromContext),
);
dictionaryRoutes.patch("/:id", asyncHandler(dictionaryController.update));
dictionaryRoutes.post("/:id/review", asyncHandler(dictionaryController.review));
dictionaryRoutes.delete("/:id", asyncHandler(dictionaryController.remove));
