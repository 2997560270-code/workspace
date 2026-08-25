import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { rm } from "node:fs/promises";
import path from "node:path";

const auth = vi.hoisted(() => ({
  user: { id: "multi-role-integration-user", email: "multi-role@example.com", name: "Multi Role User", source: "demo" as const },
}));

vi.mock("../src/lib/api/server", () => ({
  apiError: (message: string, status = 400, details?: unknown) => Response.json({ error: message, details }, { status }),
  parseJsonBody: async (request: Request) => request.json().catch(() => null),
  requireApiUser: async () => auth.user,
}));
vi.mock("../src/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => null }));
vi.mock("../src/lib/monitoring/server", () => ({ captureServerException: vi.fn() }));

import { GET, POST } from "../src/app/api/multi-role/sessions/route";

const statePath = path.join(process.cwd(), "data", "local-runtime-state.json");

function request(body: unknown) {
  return new Request("http://localhost/api/multi-role/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function json(response: Response) {
  return response.json() as Promise<Record<string, any>>;
}

describe("multi-role session API", () => {
  beforeAll(async () => {
    process.env.ALLOW_DEMO_AUTH = "true";
    await rm(statePath, { force: true });
  });

  afterAll(async () => {
    await rm(statePath, { force: true });
  });

  it("persists separate role sessions and restores the transcript", async () => {
    const started = await POST(request({ action: "start", scenarioId: "inventory-discrepancy", roleId: "finance", resume: true }));
    expect(started.status).toBe(201);
    const startedBody = await json(started);
    const sessionId = startedBody.session.id as string;
    expect(startedBody.session.messages).toHaveLength(1);
    expect(startedBody.session.messages[0]).toMatchObject({ author: "role" });

    const resumed = await POST(request({ action: "start", scenarioId: "inventory-discrepancy", roleId: "finance", resume: true }));
    expect(resumed.status).toBe(200);
    expect((await json(resumed)).session.id).toBe(sessionId);

    const sent = await POST(request({ action: "message", sessionId, content: "现在的流程是什么？" }));
    expect(sent.status).toBe(200);
    const sentBody = await json(sent);
    expect(sentBody.session.messages).toHaveLength(3);
    expect(sentBody.session.messages[1]).toMatchObject({ author: "user", content: "现在的流程是什么？" });
    expect(sentBody.session.messages[2]).toMatchObject({ author: "role" });

    const loaded = await GET(new Request(`http://localhost/api/multi-role/sessions?sessionId=${sessionId}`));
    expect(loaded.status).toBe(200);
    expect((await json(loaded)).session.messages).toHaveLength(3);
  });
});
