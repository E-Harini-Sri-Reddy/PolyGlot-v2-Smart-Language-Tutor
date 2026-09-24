import { Router } from "express";
import { authRoutes } from "./authRoutes.js";
import { chatRoutes } from "./chatRoutes.js";
import { dictionaryRoutes } from "./dictionaryRoutes.js";
import { learningRoutes } from "./learningRoutes.js";
import { scenarioRoutes } from "./scenarioRoutes.js";
import { quizRoutes } from "./quizRoutes.js";
import { settingsRoutes } from "./settingsRoutes.js";
import {
  SUPPORTED_LANGUAGES,
  PROFICIENCY_LEVELS,
  TUTOR_PERSONALITIES,
} from "../constants/languages.js";

export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => {
  res.json({ success: true, service: "PolyGlot AI", tutor: "Polly" });
});

apiRouter.get("/meta/languages", (_req, res) => {
  res.json({
    success: true,
    languages: SUPPORTED_LANGUAGES,
    levels: PROFICIENCY_LEVELS,
    personalities: TUTOR_PERSONALITIES,
  });
});

apiRouter.use("/auth", authRoutes);
apiRouter.use("/chat", chatRoutes);
apiRouter.use("/dictionary", dictionaryRoutes);
apiRouter.use("/learning", learningRoutes);
apiRouter.use("/scenarios", scenarioRoutes);
apiRouter.use("/quizzes", quizRoutes);
apiRouter.use("/settings", settingsRoutes);
