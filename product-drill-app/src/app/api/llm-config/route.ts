import { apiError, parseJsonBody, requireApiUser } from "@/lib/api/server";
import { LlmConfigDeleteQuerySchema, LlmProviderConfigSchema } from "@/lib/api/llm-config-schemas";
import { deleteLlmConfig, getLlmConfigSecret, listLlmConfigs, upsertLlmConfig } from "@/lib/repositories/llm-config-repository";
import { validateLlmConfig } from "@/lib/api/llm-call";
import { captureServerException } from "@/lib/monitoring/server";

function llmConfigError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "LLM config persistence is not configured") return apiError("模型配置服务尚未配置数据库。", 503);
  if (message === "apiKey required when no existing config") return apiError("该提供方尚未保存 API 密钥，请填写后再保存。", 400);
  return apiError("模型配置操作失败。", 400);
}

export async function GET() {
  const user = await requireApiUser();
  if (!user) return apiError("请先登录。", 401);
  try {
    const configs = await listLlmConfigs(user.id);
    return Response.json({ configs });
  } catch (error) {
    captureServerException(error, { area: "llm_config_list" });
    return llmConfigError(error);
  }
}

export async function POST(request: Request) {
  const user = await requireApiUser();
  if (!user) return apiError("请先登录。", 401);
  const parsed = LlmProviderConfigSchema.safeParse(await parseJsonBody(request));
  if (!parsed.success) return apiError("模型配置格式无效。", 422, parsed.error.flatten());
  try {
    let apiKey = parsed.data.apiKey;
    let baseUrl = parsed.data.baseUrl;
    let model = parsed.data.model;
    if (!apiKey) {
      const stored = await getLlmConfigSecret(user.id, parsed.data.provider);
      if (!stored) return apiError("该提供方尚未保存 API 密钥，请填写后再保存。", 400);
      apiKey = stored.apiKey;
      baseUrl = baseUrl || stored.baseUrl;
      model = model || stored.model;
    }
    // 严格校验：模型名必须与该 API 真实匹配（实际调用一次 chat/completions）。
    await validateLlmConfig({ baseUrl, apiKey, model });
    const config = await upsertLlmConfig(user.id, parsed.data);
    return Response.json({ config });
  } catch (error) {
    captureServerException(error, { area: "llm_config_upsert", provider: parsed.data.provider });
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("上游返回") || message.includes("choices") || message.includes("chat/completions") || message.includes("超时")) {
      return apiError("模型验证失败：" + message, 422);
    }
    return llmConfigError(error);
  }
}

export async function DELETE(request: Request) {
  const user = await requireApiUser();
  if (!user) return apiError("请先登录。", 401);
  const url = new URL(request.url);
  const parsed = LlmConfigDeleteQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return apiError("缺少 provider 参数。", 400);
  try {
    await deleteLlmConfig(user.id, parsed.data.provider);
    return Response.json({ ok: true });
  } catch (error) {
    captureServerException(error, { area: "llm_config_delete", provider: parsed.data.provider });
    return llmConfigError(error);
  }
}