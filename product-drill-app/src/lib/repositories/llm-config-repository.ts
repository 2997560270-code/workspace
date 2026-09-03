import { createSupabaseAdminClient } from "../supabase/admin";
import { isLocalRuntimeFallbackEnabled, withLocalRuntimeState } from "../local-runtime-store";
import { decryptSecret, encryptSecret, maskSecret } from "../secret-crypto";
import { LlmConfigPublic, LlmConfigPublicSchema, LlmProviderConfig } from "../api/llm-config-schemas";

export type StoredLlmSecret = {
  provider: string;
  baseUrl: string;
  model: string;
  temperature: number;
  enabled: boolean;
  apiKey: string;
};

function toPublic(row: { provider: string; label?: string | null; baseUrl: string; model: string; temperature: number | null; enabled: boolean; apiKey?: string; updatedAt?: string }): LlmConfigPublic {
  return LlmConfigPublicSchema.parse({
    provider: row.provider,
    label: row.label ?? null,
    baseUrl: row.baseUrl,
    model: row.model,
    temperature: row.temperature ?? 0.7,
    enabled: row.enabled,
    hasApiKey: Boolean(row.apiKey),
    apiKeyMasked: row.apiKey ? maskSecret(row.apiKey) : undefined,
    updatedAt: row.updatedAt
  });
}

export async function listLlmConfigs(userId: string): Promise<LlmConfigPublic[]> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    if (!isLocalRuntimeFallbackEnabled()) throw new Error("LLM config persistence is not configured");
    return withLocalRuntimeState((state) => {
      const rows = (state.llmConfigs as unknown as Record<string, unknown>[]).filter((item) => item.user_id === userId);
      return rows.map((row) => toPublic({
        provider: String(row.provider),
        label: row.label ? String(row.label) : null,
        baseUrl: String(row.base_url),
        model: String(row.model),
        temperature: typeof row.temperature === "number" ? row.temperature : null,
        enabled: Boolean(row.enabled),
        apiKey: row.api_key ? String(row.api_key) : undefined,
        updatedAt: row.updated_at ? String(row.updated_at) : undefined
      }));
    });
  }

  const { data, error } = await admin.from("user_llm_configs").select("provider,label,base_url,api_key_encrypted,model,temperature,enabled,updated_at").eq("user_id", userId).order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => toPublic({
    provider: row.provider,
    label: row.label,
    baseUrl: row.base_url,
    model: row.model,
    temperature: row.temperature,
    enabled: row.enabled,
    apiKey: decryptSecret(row.api_key_encrypted),
    updatedAt: row.updated_at
  }));
}

export async function getLlmConfigSecret(userId: string, provider: string): Promise<StoredLlmSecret | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    if (!isLocalRuntimeFallbackEnabled()) throw new Error("LLM config persistence is not configured");
    return withLocalRuntimeState((state) => {
      const row = (state.llmConfigs as unknown as Record<string, unknown>[]).find((item) => item.user_id === userId && item.provider === provider);
      if (!row) return null;
      return { provider: String(row.provider), baseUrl: String(row.base_url), model: String(row.model), temperature: typeof row.temperature === "number" ? row.temperature : 0.7, enabled: Boolean(row.enabled), apiKey: String(row.api_key ?? "") };
    });
  }

  const { data, error } = await admin.from("user_llm_configs").select("provider,base_url,api_key_encrypted,model,temperature,enabled").eq("user_id", userId).eq("provider", provider).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { provider: data.provider, baseUrl: data.base_url, model: data.model, temperature: data.temperature, enabled: data.enabled, apiKey: decryptSecret(data.api_key_encrypted) };
}

export async function upsertLlmConfig(userId: string, config: LlmProviderConfig): Promise<LlmConfigPublic> {
  const now = new Date().toISOString();
  const admin = createSupabaseAdminClient();
  const apiKey = config.apiKey;

  if (!admin) {
    if (!isLocalRuntimeFallbackEnabled()) throw new Error("LLM config persistence is not configured");
    return withLocalRuntimeState((state) => {
      const list = state.llmConfigs as unknown as Record<string, unknown>[];
      const existing = list.find((item) => item.user_id === userId && item.provider === config.provider);
      const resolvedApiKey = apiKey || (existing ? String(existing.api_key ?? "") : "");
      if (!resolvedApiKey) throw new Error("apiKey required when no existing config");
      const record = { user_id: userId, provider: config.provider, label: config.label ?? null, base_url: config.baseUrl, api_key: resolvedApiKey, model: config.model, temperature: config.temperature, enabled: config.enabled, updated_at: now };
      const index = list.findIndex((item) => item.user_id === userId && item.provider === config.provider);
      if (index >= 0) list[index] = record; else list.push(record);
      return toPublic({ provider: config.provider, label: config.label ?? null, baseUrl: config.baseUrl, model: config.model, temperature: config.temperature, enabled: config.enabled, apiKey: resolvedApiKey, updatedAt: now });
    });
  }

  let apiKeyEncrypted: string;
  if (apiKey) {
    apiKeyEncrypted = encryptSecret(apiKey);
  } else {
    const existing = await admin.from("user_llm_configs").select("api_key_encrypted").eq("user_id", userId).eq("provider", config.provider).maybeSingle();
    if (existing.error) throw existing.error;
    if (!existing.data) throw new Error("apiKey required when no existing config");
    apiKeyEncrypted = existing.data.api_key_encrypted;
  }

  const { error } = await admin.from("user_llm_configs").upsert({
    user_id: userId,
    provider: config.provider,
    label: config.label ?? null,
    base_url: config.baseUrl,
    api_key_encrypted: apiKeyEncrypted,
    model: config.model,
    temperature: config.temperature,
    enabled: config.enabled,
    updated_at: now
  }, { onConflict: "user_id,provider" });
  if (error) throw error;

  const publicConfig = await listLlmConfigs(userId);
  const saved = publicConfig.find((item) => item.provider === config.provider);
  if (!saved) throw new Error("Failed to read back LLM config");
  return saved;
}

export async function deleteLlmConfig(userId: string, provider: string): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    if (!isLocalRuntimeFallbackEnabled()) throw new Error("LLM config persistence is not configured");
    return withLocalRuntimeState((state) => {
      const before = state.llmConfigs.length;
      state.llmConfigs = (state.llmConfigs as unknown as Record<string, unknown>[]).filter((item) => !(item.user_id === userId && item.provider === provider)) as typeof state.llmConfigs;
      return state.llmConfigs.length < before;
    });
  }
  const { error } = await admin.from("user_llm_configs").delete().eq("user_id", userId).eq("provider", provider);
  if (error) throw error;
  return true;
}