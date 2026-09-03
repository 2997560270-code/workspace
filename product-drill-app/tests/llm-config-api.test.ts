import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { rm } from "node:fs/promises";
import path from "node:path";

const fetchMock = vi.hoisted(() => {
  return async (url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}"));
    const model = body?.model ?? "";
    if (model === "bad-model") {
      return new Response(JSON.stringify({ error: { message: "Model Not Exist" } }), { status: 404, headers: { "content-type": "application/json" } });
    }
    if (model === "empty-model") {
      return new Response(JSON.stringify({ choices: [{ message: { content: "" } }] }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({ choices: [{ message: { content: "连接成功" } }] }), { status: 200, headers: { "content-type": "application/json" } });
  };
});

const auth = vi.hoisted(() => ({
  user: { id: "llm-config-test-user", email: "admin@example.com", name: "Admin", source: "demo" as const } as { id: string; email: string; name: string; source: "supabase" | "demo" },
}));

vi.mock("../src/lib/api/server", () => ({
  apiError: (message: string, status = 400, details?: unknown) => Response.json({ error: message, details }, { status }),
  parseJsonBody: async (request: Request) => request.json().catch(() => null),
  requireApiUser: async () => auth.user,
}));
vi.mock("../src/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => null }));
vi.mock("../src/lib/monitoring/server", () => ({ captureServerException: vi.fn() }));

import { GET, POST, DELETE } from "../src/app/api/llm-config/route";

const statePath = vi.hoisted(() => {
  const file = process.cwd().replace(/\\/g, "/") + "/data/llm-config-test-state.json";
  process.env.LOCAL_RUNTIME_STATE_PATH = file;
  return file;
});

function request(body: unknown) {
  return new Request("http://localhost/api/llm-config", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function body(response: Response) {
  return response.json() as Promise<Record<string, any>>;
}

describe("llm config API", () => {
  beforeAll(async () => {
    process.env.ALLOW_DEMO_AUTH = "true";
    vi.stubGlobal("fetch", fetchMock);
    await rm(statePath, { force: true });
  });
  afterAll(async () => {
    await rm(statePath, { force: true });
    delete process.env.ALLOW_DEMO_AUTH;
    vi.unstubAllGlobals();
  });

  it("rejects an invalid base url", async () => {
    const res = await POST(request({ provider: "deepseek", baseUrl: "not-a-url", apiKey: "sk-test", model: "deepseek-chat", temperature: 0.7, enabled: true }));
    expect(res.status).toBe(422);
  });

  it("rejects a model name that does not match the provider", async () => {
    const res = await POST(request({ provider: "deepseek", baseUrl: "https://api.deepseek.com/v1", apiKey: "sk-test", model: "bad-model", temperature: 0.7, enabled: true }));
    expect(res.status).toBe(422);
    const captured = await body(res);
    expect(captured.error).toContain("模型验证失败");
    const after = await GET();
    expect((await body(after)).configs).toHaveLength(0);
  });

  it("accepts a 2xx response even when the content is empty (reasoning-style model)", async () => {
    const res = await POST(request({ provider: "deepseek", baseUrl: "https://api.deepseek.com/v1", apiKey: "sk-test", model: "empty-model", temperature: 0.7, enabled: true }));
    expect(res.status).toBe(200);
    expect((await body(res)).config.model).toBe("empty-model");
    await DELETE(new Request("http://localhost/api/llm-config?provider=deepseek", { method: "DELETE" }));
  });

  it("lists, saves and deletes provider configs", async () => {
    const saved = await POST(request({ provider: "deepseek", baseUrl: "https://api.deepseek.com/v1", apiKey: "sk-secret-12345", model: "deepseek-chat", temperature: 0.5, enabled: true }));
    expect(saved.status).toBe(200);
    const savedBody = await body(saved);
    expect(savedBody.config).toMatchObject({ provider: "deepseek", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat", temperature: 0.5, enabled: true, hasApiKey: true });
    expect(savedBody.config.apiKeyMasked).toContain("****");
    expect(savedBody.config.apiKey).toBeUndefined();

    const fetched = await GET();
    expect(fetched.status).toBe(200);
    const fetchedBody = await body(fetched);
    expect(fetchedBody.configs).toHaveLength(1);
    expect(fetchedBody.configs[0].model).toBe("deepseek-chat");

    const cleared = await DELETE(new Request("http://localhost/api/llm-config?provider=deepseek", { method: "DELETE" }));
    expect(cleared.status).toBe(200);
    expect((await body(cleared)).ok).toBe(true);

    const after = await GET();
    expect((await body(after)).configs).toHaveLength(0);
  });
});