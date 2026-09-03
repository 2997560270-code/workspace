// 严格的「标准 OpenAI 兼容 chat/completions」调用，供配置验证与测试连接共用。

export type LlmCallResult = {
  reply: string;
  usage?: unknown;
  latencyMs: number;
};

export const LLM_VALIDATION_PROMPT = "请只回复：连接成功";

export function normalizeBaseUrl(baseUrl: string): string {
  const url = baseUrl.trim().replace(/\/+$/, "");
  return /\/chat\/completions$/.test(url) ? url : `${url}/chat/completions`;
}

export async function callChatCompletions(opts: {
  baseUrl: string;
  apiKey: string;
  model: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<LlmCallResult> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(normalizeBaseUrl(opts.baseUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${opts.apiKey}`
      },
      body: JSON.stringify({
        model: opts.model,
        messages: [{ role: "user", content: opts.prompt }],
        temperature: opts.temperature ?? 0.7,
        max_tokens: opts.maxTokens ?? 200
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    const text = await response.text();
    let data: any = null;
    try { data = JSON.parse(text); } catch { /* 非 JSON 响应 */ }

    // 1) HTTP 状态必须 2xx，否则把上游错误透出（401 密钥错、404 模型不存在等）。
    if (!response.ok) {
      const message = data?.error?.message ?? data?.error ?? response.statusText;
      throw new Error(`上游返回 ${response.status}: ${typeof message === "string" ? message : JSON.stringify(message)}`);
    }

    // 2) 必须是合法对象。
    if (!data || typeof data !== "object") throw new Error("上游返回的不是合法 JSON（缺少 choices）。");

    // 3) 必须符合 chat/completions：有 choices 数组。只要有 choices 即视为调用成功；
    //    部分推理类模型 content 可能为空/缺失，真正判定「模型名不存在」靠的是非 2xx。
    const choices = data?.choices;
    if (!Array.isArray(choices) || choices.length === 0) throw new Error("上游返回格式不符合 chat/completions（缺少 choices）。");

    // 4) 提取可读内容：优先 content，其次 reasoning_content / text；为空不判失败。
    const message = choices[0]?.message ?? {};
    let reply = typeof message.content === "string" ? message.content : "";
    if (!reply.trim() && typeof message.reasoning_content === "string") reply = message.reasoning_content;
    if (!reply.trim() && typeof choices[0]?.text === "string") reply = choices[0].text;

    return { reply, usage: data?.usage, latencyMs: Date.now() - startedAt };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("请求超时（30 秒）。");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

// 配置校验：用用户填写的 API + 模型实际跑一次，模型不存在/密钥错/地址错都会失败。
export function validateLlmConfig(opts: { baseUrl: string; apiKey: string; model: string }): Promise<LlmCallResult> {
  return callChatCompletions({ ...opts, prompt: LLM_VALIDATION_PROMPT, maxTokens: 32, temperature: 0.7 });
}