import { describe, expect, it } from "vitest";
import { canSyncClientHistory } from "../src/lib/api/server";
import { assertSessionOwner } from "../src/lib/repositories/training-repository";
import { isFormalRetryImprovement } from "../src/lib/training-history";
import { createTrainingSession } from "../src/lib/training-session";

describe("security remediation invariants", () => {
  it("never accepts client history synchronization for a Supabase identity", () => {
    expect(canSyncClientHistory("supabase")).toBe(false);
    expect(canSyncClientHistory("demo")).toBe(true);
  });

  it("rejects an existing session owned by another user", () => {
    expect(() => assertSessionOwner("victim-user", "attacker-user")).toThrow(/ownership/i);
    expect(() => assertSessionOwner("same-user", "same-user")).not.toThrow();
    expect(() => assertSessionOwner(null, "new-user")).not.toThrow();
  });

  it("uses unguessable UUID session and message identifiers", () => {
    const session = createTrainingSession({ scenarioId: "dashboard-request" });
    expect(session.id).toMatch(/^session-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(session.messages[0].id).toMatch(/^msg-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it("requires OpenAI retry provenance before formal improvement", () => {
    expect(isFormalRetryImprovement({
      issueId: "issue",
      targetSkill: "workflow",
      answer: "目前流程是什么？",
      improved: true,
      feedback: "practice",
      engine: "deterministic",
      modelVersion: "deterministic-v1"
    })).toBe(false);
    expect(isFormalRetryImprovement({
      issueId: "issue",
      targetSkill: "workflow",
      answer: "目前流程是什么？",
      improved: true,
      feedback: "formal",
      engine: "openai",
      modelVersion: "test-model"
    })).toBe(true);
  });
});
