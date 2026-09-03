import type { LlmConfigPublic, LlmProviderConfig } from "./llm-config-schemas";

export class LlmConfigApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "LlmConfigApiError";
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store"
  });
  const payload = await response.json().catch(() => ({})) as { error?: string } & T;
  if (!response.ok) throw new LlmConfigApiError(payload.error ?? "模型配置请求失败，请稍后重试。", response.status);
  return payload;
}

export async function fetchLlmConfigs(): Promise<LlmConfigPublic[]> {
  const data = await requestJson<{ configs: LlmConfigPublic[] }>("/api/llm-config");
  return data.configs;
}

export async function saveLlmConfig(input: LlmProviderConfig): Promise<LlmConfigPublic> {
  const data = await requestJson<{ config: LlmConfigPublic }>("/api/llm-config", { method: "POST", body: JSON.stringify(input) });
  return data.config;
}

export async function deleteLlmConfig(provider: string): Promise<void> {
  await requestJson<{ ok: boolean }>("/api/llm-config?provider=" + encodeURIComponent(provider), { method: "DELETE" });
}

export async function testLlmConnection(input: { provider?: string; baseUrl?: string; model?: string; apiKey?: string; prompt?: string }): Promise<{ reply: string; latencyMs: number }> {
  const data = await requestJson<{ ok: boolean; reply: string; latencyMs: number }>("/api/llm-config/test", { method: "POST", body: JSON.stringify(input) });
  return { reply: data.reply, latencyMs: data.latencyMs };
}