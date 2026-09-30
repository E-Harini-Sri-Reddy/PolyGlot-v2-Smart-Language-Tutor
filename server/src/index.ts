import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { ZodError } from "zod";
import { connectDatabase } from "./config/db.js";
import { env } from "./config/env.js";
import { apiRouter } from "./routes/index.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { AppError } from "./utils/errors.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function bootstrap() {
  await connectDatabase();

  const { scenarioService } = await import("./services/scenarioService.js");
  const seeded = await scenarioService.ensurePresetsSeeded();
  console.log(`Preset scenarios ready (${seeded} templates)`);

  const app = express();

  // Required on Render / reverse proxies so secure cookies and IPs work
  app.set("trust proxy", 1);

  const allowedOrigins = new Set(
    [env.CLIENT_URL, `http://localhost:${env.PORT}`, `http://127.0.0.1:${env.PORT}`]
      .filter(Boolean)
      .map((value) => value.replace(/\/$/, "")),
  );

  app.use(
    cors({
      origin(origin, callback) {
        // Same-origin / non-browser requests send no Origin
        if (!origin || allowedOrigins.has(origin.replace(/\/$/, ""))) {
          return callback(null, true);
        }
        // Allow the public Render URL even if CLIENT_URL is slightly off
        if (env.NODE_ENV === "production") {
          return callback(null, true);
        }
        return callback(new Error(`CORS blocked for origin: ${origin}`));
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.use("/api", apiRouter);

  const distPath = path.join(__dirname, "../../dist");
  app.use(express.static(distPath));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }
    res.sendFile(path.join(distPath, "index.html"), (err) => {
      if (err) next();
    });
  });

  app.use(notFoundHandler);
  app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof ZodError) {
      return next(
        new AppError(400, "VALIDATION_ERROR", err.issues[0]?.message || "Invalid input."),
      );
    }
    return errorHandler(err, req, res, next);
  });

  app.listen(env.PORT, () => {
    console.log(`PolyGlot AI server running on port ${env.PORT}`);
    console.log(`AI model: ${env.AI_MODEL}`);
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
