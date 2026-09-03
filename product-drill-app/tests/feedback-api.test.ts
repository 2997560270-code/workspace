import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { rm } from "node:fs/promises";
import path from "node:path";

const auth = vi.hoisted(() => ({
  user: { id: "feedback-test-user", email: "admin@example.com", name: "Admin", source: "demo" as const } as
    { id: string; email: string; name: string; source: "supabase" | "demo" } | null,
}));

vi.mock("../src/lib/api/server", () => ({
  apiError: (message: string, status = 400, details?: unknown) => Response.json({ error: message, details }, { status }),
  parseJsonBody: async (request: Request) => request.json().catch(() => null),
  requireApiUser: async () => auth.user,
}));
vi.mock("../src/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => null }));
vi.mock("../src/lib/monitoring/server", () => ({ captureServerException: vi.fn() }));

import { POST, GET } from "../src/app/api/feedback/route";

const statePath = vi.hoisted(() => {
  const file = process.cwd().replace(/\\/g, "/") + "/data/feedback-test-state.json";
  process.env.LOCAL_RUNTIME_STATE_PATH = file;
  return file;
});

function request(body: unknown) {
  return new Request("http://localhost/api/feedback", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
function getRequest(query = "") {
  return new Request(`http://localhost/api/feedback${query}`);
}
async function body(response: Response) {
  return response.json() as Promise<Record<string, any>>;
}

describe("feedback API", () => {
  beforeAll(async () => {
    process.env.ALLOW_DEMO_AUTH = "true";
    await rm(statePath, { force: true });
  });

  afterAll(async () => {
    await rm(statePath, { force: true });
    delete process.env.ALLOW_DEMO_AUTH;
  });

  it("rejects invalid submissions", async () => {
    auth.user = { id: "feedback-test-user", email: "admin@example.com", name: "Admin", source: "demo" };
    const res = await POST(request({ category: "experience", content: "短" }));
    expect(res.status).toBe(422);
  });

  it("persists a valid submission and lists it back", async () => {
    auth.user = { id: "feedback-test-user", email: "admin@example.com", name: "Admin", source: "demo" };
    const created = await POST(request({ category: "experience", content: "使用体验很好，但加载有点慢。", rating: 3, page: "/world" }));
    expect(created.status).toBe(201);
    const createdBody = await body(created);
    expect(createdBody.record).toMatchObject({ category: "experience", status: "open", userId: auth.user.id });
    expect(createdBody.record.content).toBe("使用体验很好，但加载有点慢。");
    expect(createdBody.record.rating).toBe(3);

    const list = await GET(getRequest());
    expect(list.status).toBe(200);
    const listBody = await body(list);
    expect(listBody.records).toHaveLength(1);
    expect(listBody.records[0]).toMatchObject({ category: "experience", status: "open", userId: auth.user.id });

    const filtered = await GET(getRequest("?category=bug"));
    expect(filtered.status).toBe(200);
    expect((await body(filtered)).records).toHaveLength(0);
  });

  it("captures anonymous feedback when no user is logged in", async () => {
    auth.user = null;
    const res = await POST(request({ category: "bug", content: "点击按钮无响应。", contact: "user@example.com" }));
    expect(res.status).toBe(201);
    const b = await body(res);
    expect(b.record.userId).toBeNull();
    expect(b.record.category).toBe("bug");
  });
});
