import { apiError, parseJsonBody, requireApiUser } from "@/lib/api/server";
import { LlmTestRequestSchema } from "@/lib/api/llm-config-schemas";
import { callChatCompletions } from "@/lib/api/llm-call";
import { getLlmConfigSecret } from "@/lib/repositories/llm-config-repository";
import { captureServerException } from "@/lib/monitoring/server";

export async function POST(request: Request) {
  const user = await requireApiUser();
  if (!user) return apiError("请先登录。", 401);
  const parsed = LlmTestRequestSchema.safeParse(await parseJsonBody(request));
  if (!parsed.success) return apiError("测试配置格式无效。", 422, parsed.error.flatten());

  let baseUrl = parsed.data.baseUrl ?? "";
  let model = parsed.data.model ?? "";
  let apiKey = parsed.data.apiKey ?? "";
  const provider = parsed.data.provider ?? "";

  try {
    if (!apiKey || !baseUrl || !model) {
      if (!provider) return apiError("请提供 provider，或直接传入 baseUrl/model/apiKey。", 400);
      const stored = await getLlmConfigSecret(user.id, provider);
      if (!stored) return apiError("未找到该提供方的已保存配置。", 404);
      apiKey = apiKey || stored.apiKey;
      baseUrl = baseUrl || stored.baseUrl;
      model = model || stored.model;
    }
    if (!apiKey || !baseUrl || !model) return apiError("缺少 baseUrl / model / apiKey。", 400);
    const result = await callChatCompletions({ baseUrl, apiKey, model, prompt: parsed.data.prompt ?? "请回复 OK。", temperature: 0.7, maxTokens: 200 });
    const reply = result.reply || "(模型已响应，但未返回文本内容)";
    return Response.json({ ok: true, provider: provider || undefined, model, reply, latencyMs: result.latencyMs });
  } catch (error) {
    captureServerException(error, { area: "llm_config_test", provider: provider || undefined });
    const message = error instanceof Error ? error.message : "测试连接失败。";
    return apiError(message, 502);
  }
}