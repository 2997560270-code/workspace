import { z } from "zod";

// 常见大模型提供方预设（OpenAI 兼容地址）。
export const LLM_PROVIDER_PRESETS = [
  { id: "openai", name: "OpenAI", baseUrl: "https://api.openai.com/v1" },
  { id: "deepseek", name: "DeepSeek", baseUrl: "https://api.deepseek.com/v1" },
  { id: "qwen", name: "通义千问 Qwen", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1" },
  { id: "zhipu", name: "智谱 GLM", baseUrl: "https://open.bigmodel.cn/api/paas/v4" },
  { id: "amazon-bedrock", name: "Amazon Bedrock", baseUrl: "" },
  { id: "custom", name: "自定义", baseUrl: "" },
] as const;

export function providerName(id: string): string {
  return LLM_PROVIDER_PRESETS.find((item) => item.id === id)?.name ?? id;
}

// 新增/编辑时提交的完整配置。
export const LlmProviderConfigSchema = z.object({
  provider: z.string().trim().min(1).max(80),
  label: z.string().trim().max(120).optional(),
  baseUrl: z.string().url().max(500),
  apiKey: z.string().trim().min(1).max(500).optional(),
  model: z.string().trim().min(1).max(200),
  temperature: z.number().min(0).max(2).default(0.7),
  enabled: z.boolean().default(true)
});

export type LlmProviderConfig = z.infer<typeof LlmProviderConfigSchema>;

// 返回给客户端的配置（不含明文 API Key）。
export const LlmConfigPublicSchema = z.object({
  provider: z.string().min(1),
  label: z.string().nullable().optional(),
  baseUrl: z.string().url().max(500),
  model: z.string().min(1),
  temperature: z.number().min(0).max(2),
  enabled: z.boolean(),
  hasApiKey: z.boolean(),
  apiKeyMasked: z.string().optional(),
  updatedAt: z.string().datetime().optional()
});

export type LlmConfigPublic = z.infer<typeof LlmConfigPublicSchema>;

// 删除某条提供方配置的查询参数。
export const LlmConfigDeleteQuerySchema = z.object({
  provider: z.string().trim().min(1).max(80)
});

// 测试连接：优先用提交的 apiKey；否则用已保存的 provider 配置。
export const LlmTestRequestSchema = z.object({
  provider: z.string().trim().min(1).max(80).optional(),
  baseUrl: z.string().url().max(500).optional(),
  model: z.string().trim().min(1).max(200).optional(),
  apiKey: z.string().trim().min(1).max(500).optional(),
  prompt: z.string().trim().min(1).max(2000).optional()
});

export type LlmTestRequest = z.infer<typeof LlmTestRequestSchema>;