import { describe, expect, it } from "vitest";
import { selectNextChallengeForUser } from "../src/lib/challenge-selection";
import {
  appendWorldEvent,
  completeChallengeRun,
  insertChallengeRun,
  insertDecisionEvent,
  upsertJudgmentHypothesis,
} from "../src/lib/repositories/challenge-repository";
import { createJudgmentHypothesis } from "../src/lib/causal-world";

async function completeWorld(userId: string, worldId: string) {
  const run = await insertChallengeRun(userId, worldId, "2.0.0", "deterministic-v1");
  const event = await appendWorldEvent({
    runId: run.id,
    userId,
    eventType: "user_action",
    sequenceIndex: 0,
    actor: "user",
    payload: { text: "Investigate the current workflow", discovery_dimension: "workflow" },
  });
  const decision = await insertDecisionEvent({
    userId,
    runId: run.id,
    worldEventId: event.id,
    judgment: "Validate the problem before committing",
    chosenAction: "Run a bounded investigation",
    expectedOutcome: "Resolve the largest uncertainty",
    confidence: "medium",
    rejectedAlternatives: [],
    evidenceBasis: [event.id],
  });
  await completeChallengeRun(userId, run.id);
  return { run, decision };
}

async function setHypothesis(userId: string, confidence: "insufficient" | "low" | "medium" | "high") {
  return upsertJudgmentHypothesis(createJudgmentHypothesis({
    id: `hyp-${userId}`,
    userId,
    habitName: "premature_solution_commitment",
    confidence,
  }));
}

describe("selectNextChallengeForUser", () => {
  it("starts with the governed calibration world", async () => {
    const userId = `selector-start-${crypto.randomUUID()}`;
    const selection = await selectNextChallengeForUser(userId);
    expect(selection.world_id).toBe("world-1-ai-summary");
    expect(selection.loop_complete).toBe(false);
    expect(selection.transfer_role).toBe("calibration");
    expect(selection.reason).toContain("校准世界");
  });

  it("chooses the intervention world after calibration even with insufficient evidence", async () => {
    const userId = `selector-intervention-${crypto.randomUUID()}`;
    await completeWorld(userId, "world-1-ai-summary");
    await setHypothesis(userId, "insufficient");

    const selection = await selectNextChallengeForUser(userId);
    expect(selection.world_id).toBe("world-2-enterprise-renewal");
    expect(selection.is_transfer_test).toBe(false);
  });

  it("only selects the transfer world when confidence clears the gate", async () => {
    const userId = `selector-transfer-${crypto.randomUUID()}`;
    await completeWorld(userId, "world-1-ai-summary");
    await completeWorld(userId, "world-2-enterprise-renewal");
    await setHypothesis(userId, "medium");

    const selection = await selectNextChallengeForUser(userId);
    expect(selection.world_id).toBe("world-3-growth-decline");
    expect(selection.is_transfer_test).toBe(true);
    expect(selection.completed_world_ids).toEqual(
      expect.arrayContaining(["world-1-ai-summary", "world-2-enterprise-renewal"])
    );
  });

  it("uses a non-persisted progression confidence for a degraded practice run", async () => {
    const userId = `selector-practice-${crypto.randomUUID()}`;
    await completeWorld(userId, "world-1-ai-summary");
    await completeWorld(userId, "world-2-enterprise-renewal");
    await setHypothesis(userId, "insufficient");

    const selection = await selectNextChallengeForUser(userId, "medium");
    expect(selection.world_id).toBe("world-3-growth-decline");
    expect(selection.is_transfer_test).toBe(true);
    const persistedSelection = await selectNextChallengeForUser(userId);
    expect(persistedSelection.is_remediation).toBe(true);
  });

  it("returns an explainable same-world remediation when the transfer gate is not met", async () => {
    const userId = `selector-remediation-${crypto.randomUUID()}`;
    await completeWorld(userId, "world-1-ai-summary");
    await completeWorld(userId, "world-2-enterprise-renewal");
    await setHypothesis(userId, "low");

    const selection = await selectNextChallengeForUser(userId);
    expect(["world-1-ai-summary", "world-2-enterprise-renewal"]).toContain(selection.world_id);
    expect(selection.is_remediation).toBe(true);
    expect(selection.reason).toContain("修正练习");
  });

  it("marks the loop complete after all worlds even when confidence is low", async () => {
    const userId = `selector-complete-${crypto.randomUUID()}`;
    await completeWorld(userId, "world-1-ai-summary");
    await completeWorld(userId, "world-2-enterprise-renewal");
    await completeWorld(userId, "world-3-growth-decline");
    await setHypothesis(userId, "low");

    const selection = await selectNextChallengeForUser(userId);
    expect(selection.loop_complete).toBe(true);
    expect(selection.is_remediation).toBe(false);
    expect(selection.reason).toContain("闭环证据");
  });
});
