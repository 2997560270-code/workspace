import { beforeEach, describe, expect, it, vi } from "vitest";
import { COMMUNITY_CASES, KNOWLEDGE_ENTRIES, loadCommunityCases, saveCommunityCase } from "../src/lib/resource-hub";

describe("resource hub", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal("window", { localStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) } });
  });

  it("ships governed examples and searchable knowledge entries", () => {
    expect(COMMUNITY_CASES.every((item) => item.status === "published")).toBe(true);
    expect(KNOWLEDGE_ENTRIES.length).toBeGreaterThanOrEqual(6);
  });

  it("stores new community cases as pending instead of publishing directly", () => {
    const next = saveCommunityCase({ title: "新的复盘案例", industry: "SaaS", skillId: "workflow", summary: "发现了一个流程问题。", lesson: "先还原真实步骤。", author: "本地用户" });
    expect(next.status).toBe("pending");
    expect(loadCommunityCases()).toEqual([next]);
  });
});
