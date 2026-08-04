import { describe, expect, it, vi } from "vitest";

const openaiConstructor = vi.hoisted(() => ({
  configs: [] as Array<Record<string, unknown>>,
}));

vi.mock("openai", () => ({
  default: class OpenAIMock {
    constructor(config: Record<string, unknown>) {
      openaiConstructor.configs.push(config);
    }
  },
}));

vi.mock("../src/lib/env", () => ({
  isOpenAIConfigured: () => true,
  runtimeEnv: {
    openaiApiKey: "test-key",
    openaiBaseUrl: "https://api.example.test",
  },
}));

import { getOpenAIClient } from "../src/lib/ai/client";

describe("OpenAI-compatible client", () => {
  it("passes the configured base URL to the SDK", () => {
    expect(getOpenAIClient()).not.toBeNull();
    expect(openaiConstructor.configs).toEqual([
      {
        apiKey: "test-key",
        baseURL: "https://api.example.test",
        timeout: 20_000,
        maxRetries: 1,
      },
    ]);
  });
});
