import OpenAI from "openai";
import { isOpenAIConfigured, runtimeEnv } from "../env";

let client: OpenAI | null = null;
const AI_REQUEST_TIMEOUT_MS = 30_000;

export function getOpenAIClient(): OpenAI | null {
  if (!isOpenAIConfigured()) return null;
  client ??= new OpenAI({
    apiKey: runtimeEnv.openaiApiKey,
    baseURL: runtimeEnv.openaiBaseUrl || undefined,
    timeout: AI_REQUEST_TIMEOUT_MS,
    maxRetries: 0,
  });
  return client;
}
