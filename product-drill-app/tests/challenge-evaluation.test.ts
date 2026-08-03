import { describe, expect, it } from "vitest";
import { evaluateChallengeDecision } from "../src/lib/challenge-evaluation";
import {
  appendWorldEvent,
  getChallengeRun,
  getHypothesisEvidenceForProfile,
  getJudgmentProfile,
  insertChallengeRun,
  insertDecisionEvent,
} from "../src/lib/repositories/challenge-repository";
import { getDemoWorld } from "../src/lib/world-seeds";

const WORLD_ID = "world-1-ai-summary";

async function createDecisionWithDimensions(
  userId: string,
  dimensions: Array<"workflow" | "consequence" | "alternative">,
  worldId = WORLD_ID,
) {
  const world = getDemoWorld(worldId)!;
  const run = await insertChallengeRun(userId, world.world_id, world.version.version, "deterministic-v1");
  const events = [];
  for (const [index, dimension] of dimensions.entries()) {
    events.push(await appendWorldEvent({
      runId: run.id,
      userId,
      eventType: "user_action",
      sequenceIndex: index,
      actor: "user",
      payload: { text: `Investigate ${dimension}`, discovery_dimension: dimension },
    }));
  }
  const fallbackEvent = events[0] ?? await appendWorldEvent({
    runId: run.id,
    userId,
    eventType: "user_action",
    sequenceIndex: 0,
    actor: "user",
    payload: { text: "Unstructured investigation" },
  });
  const decision = await insertDecisionEvent({
    userId,
    runId: run.id,
    worldEventId: fallbackEvent.id,
    judgment: "Validate the problem before committing",
    chosenAction: "Run a bounded discovery step",
    expectedOutcome: "Resolve the highest-risk uncertainty",
    confidence: "medium",
    rejectedAlternatives: ["Commit immediately"],
    evidenceBasis: events.map((event) => event.id),
  });
  return { run, decision };
}

describe("challenge decision evaluation integration", () => {
  it("persists traceable counter evidence and completes the run", async () => {
    const userId = `evaluation-user-${crypto.randomUUID()}`;
    const { run, decision } = await createDecisionWithDimensions(userId, [
      "workflow",
      "consequence",
      "alternative",
    ]);

    const result = await evaluateChallengeDecision({
      userId,
      runId: run.id,
      decisionEventId: decision.id,
    });

    expect(result.observation.confidence).toBe("medium");
    expect(result.update.update_direction).toBe("contradicts");
    expect(result.evidence).toMatchObject({
      decision_event_id: decision.id,
      evidence_type: "counter",
      world_id: WORLD_ID,
      model_version: "deterministic-v1",
    });
    expect(result.hypothesis.counter_evidence_ids).toContain(result.evidence!.id);
    await expect(getChallengeRun(userId, run.id)).resolves.toMatchObject({ status: "completed" });

    const profile = await getJudgmentProfile(userId);
    const evidence = await getHypothesisEvidenceForProfile(profile.map((item) => item.id));
    expect(profile).toHaveLength(1);
    expect(evidence).toHaveLength(1);
    expect(evidence[0].decision_event_id).toBe(decision.id);
  });

  it("records an insufficient hypothesis without fabricating evidence", async () => {
    const userId = `insufficient-user-${crypto.randomUUID()}`;
    const { run, decision } = await createDecisionWithDimensions(userId, []);

    const result = await evaluateChallengeDecision({
      userId,
      runId: run.id,
      decisionEventId: decision.id,
    });

    expect(result.observation.confidence).toBe("low");
    expect(result.update.update_direction).toBe("insufficient");
    expect(result.evidence).toBeNull();
    expect(result.hypothesis.confidence).toBe("insufficient");
    const evidence = await getHypothesisEvidenceForProfile([result.hypothesis.id]);
    expect(evidence).toEqual([]);
  });

  it("reuses the same evidence identity when the same decision is analyzed again", async () => {
    const userId = `repeat-user-${crypto.randomUUID()}`;
    const { run, decision } = await createDecisionWithDimensions(userId, ["workflow", "consequence"]);

    const first = await evaluateChallengeDecision({ userId, runId: run.id, decisionEventId: decision.id });
    const second = await evaluateChallengeDecision({ userId, runId: run.id, decisionEventId: decision.id });

    expect(second.update.update_direction).toBe(first.update.update_direction);
    expect(second.evidence?.id).toBe(first.evidence?.id);
    const evidence = await getHypothesisEvidenceForProfile([second.hypothesis.id]);
    expect(evidence).toHaveLength(1);
  });

  it("persists transfer evidence only after the two governed training worlds are complete", async () => {
    const userId = `transfer-evaluation-${crypto.randomUUID()}`;
    const first = await createDecisionWithDimensions(userId, ["workflow", "consequence"]);
    await evaluateChallengeDecision({ userId, runId: first.run.id, decisionEventId: first.decision.id });
    const second = await createDecisionWithDimensions(userId, ["workflow", "consequence"], "world-2-enterprise-renewal");
    await evaluateChallengeDecision({ userId, runId: second.run.id, decisionEventId: second.decision.id });
    const transfer = await createDecisionWithDimensions(
      userId,
      ["workflow", "consequence", "alternative"],
      "world-3-growth-decline",
    );

    const result = await evaluateChallengeDecision({
      userId,
      runId: transfer.run.id,
      decisionEventId: transfer.decision.id,
    });

    expect(result.evidence).toMatchObject({
      decision_event_id: transfer.decision.id,
      evidence_type: "transfer",
      transfer_world_id: "world-3-growth-decline",
    });
  });
});
