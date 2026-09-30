import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

/** Groq retired several Llama IDs in Aug 2026 — remap so old .env / Render vars keep working. */
const DEPRECATED_AI_MODELS: Record<string, string> = {
  "llama-3.1-8b-instant": "openai/gpt-oss-20b",
  "llama-3.3-70b-versatile": "openai/gpt-oss-120b",
  "llama3-8b-8192": "openai/gpt-oss-20b",
  "llama3-70b-8192": "openai/gpt-oss-120b",
  "gemma2-9b-it": "openai/gpt-oss-20b",
  "mixtral-8x7b-32768": "openai/gpt-oss-20b",
};

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  CLIENT_URL: z.string().default("http://localhost:5173"),
  AI_URL: z.string().min(1),
  AI_MODEL: z.string().min(1),
  AI_KEY: z.string().min(1),
  MONGODB_URI: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  SMTP_HOST: z.string().optional().default(""),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional().default(""),
  SMTP_PASS: z.string().optional().default(""),
  EMAIL_FROM: z.string().default("PolyGlot AI <noreply@polyglot.ai>"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const rawModel = parsed.data.AI_MODEL.trim();
const resolvedModel = DEPRECATED_AI_MODELS[rawModel] || rawModel;

if (DEPRECATED_AI_MODELS[rawModel]) {
  console.warn(
    `[AI] Model "${rawModel}" is deprecated on Groq. Using "${resolvedModel}" instead. Update AI_MODEL in .env / Render.`,
  );
}

export const env = {
  ...parsed.data,
  AI_MODEL: resolvedModel,
};
