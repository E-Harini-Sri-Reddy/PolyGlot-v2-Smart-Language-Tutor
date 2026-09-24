import OpenAI from "openai";
import { env } from "../config/env.js";

export const aiClient = new OpenAI({
  apiKey: env.AI_KEY,
  baseURL: env.AI_URL,
});
