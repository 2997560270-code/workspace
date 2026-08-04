import OpenAI from "openai";
import { isOpenAIConfigured, runtimeEnv } from "../env";

let client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI | null {
  if (!isOpenAIConfigured()) return null;
  client ??= new OpenAI({
    apiKey: runtimeEnv.openaiApiKey,
    baseURL: runtimeEnv.openaiBaseUrl || undefined,
    timeout: 20_000,
    maxRetries: 1,
  });
  return client;
}
