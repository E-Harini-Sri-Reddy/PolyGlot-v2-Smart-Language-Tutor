import { Router } from "express";
import { scenarioController } from "../controllers/scenarioController.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";

export const scenarioRoutes = Router();

scenarioRoutes.use(requireAuth);
scenarioRoutes.get("/", asyncHandler(scenarioController.list));
scenarioRoutes.get("/history", asyncHandler(scenarioController.history));
scenarioRoutes.get("/:id", asyncHandler(scenarioController.get));
scenarioRoutes.post("/custom", asyncHandler(scenarioController.createCustom));
