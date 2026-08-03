import { describe, expect, it } from "vitest";
import {
  AlreadyRevealedError,
  appendWorldEvent,
  completeChallengeRun,
  getChallengeDecisionContext,
  getChallengeDecisionRecords,
  getChallengeRun,
  insertChallengeRun,
  insertDecisionEvent,
  insertIntervention,
  revealDecisionConsequences,
} from "../src/lib/repositories/challenge-repository";

describe("demo challenge repository", () => {
  it("keeps a complete challenge run available without Supabase", async () => {
    const userId = `demo-user-${crypto.randomUUID()}`;
    const run = await insertChallengeRun(userId, "world-calibration-retention-dashboard", "v1", "deterministic-v1");

    await expect(getChallengeRun(userId, run.id)).resolves.toEqual(run);

    const event = await appendWorldEvent({
      runId: run.id,
      userId,
      eventType: "user_action",
      sequenceIndex: 0,
      actor: "user",
      payload: { text: "Who uses the dashboard?" },
    });
    const decision = await insertDecisionEvent({
      userId,
      runId: run.id,
      worldEventId: event.id,
      judgment: "Validate the current workflow first",
      chosenAction: "Interview the operations owner",
      expectedOutcome: "Identify the actual bottleneck",
      confidence: "medium",
      rejectedAlternatives: ["Build immediately"],
      evidenceBasis: [event.id],
    });

    const revealed = await revealDecisionConsequences(userId, run.id, decision.id);
    expect(revealed.consequences_revealed).toBe(true);
    await expect(revealDecisionConsequences(userId, run.id, decision.id)).rejects.toBeInstanceOf(AlreadyRevealedError);

    await completeChallengeRun(userId, run.id);
    await expect(getChallengeRun(userId, run.id)).resolves.toMatchObject({ status: "completed" });

    const records = await getChallengeDecisionRecords(userId);
    expect(records).toEqual([{ run: expect.objectContaining({ id: run.id }), decision: revealed }]);

    const intervention = await insertIntervention({
      userId,
      runId: run.id,
      decisionEventId: decision.id,
      interventionType: "reveal_consequence",
      content: "The workflow bottleneck is now visible.",
      modelVersion: "deterministic-v1",
    });
    await expect(getChallengeDecisionContext(userId, decision.id)).resolves.toMatchObject({
      run: { id: run.id },
      decision: { id: decision.id, consequences_revealed: true },
      events: [{ id: event.id }],
      interventions: [{ id: intervention.id, intervention_type: "reveal_consequence" }],
    });
  });

  it("does not expose another user's decision timeline", async () => {
    const ownerId = `demo-owner-${crypto.randomUUID()}`;
    const otherUserId = `demo-other-${crypto.randomUUID()}`;
    const run = await insertChallengeRun(ownerId, "world-1-ai-summary", "1.0.0", "deterministic-v1");
    const event = await appendWorldEvent({
      runId: run.id,
      userId: ownerId,
      eventType: "user_action",
      sequenceIndex: 0,
      actor: "user",
      payload: { text: "Inspect the current workflow" },
    });
    const decision = await insertDecisionEvent({
      userId: ownerId,
      runId: run.id,
      worldEventId: event.id,
      judgment: "Validate before committing",
      chosenAction: "Run a bounded investigation",
      expectedOutcome: "Find the root cause",
      confidence: "medium",
      rejectedAlternatives: [],
      evidenceBasis: [event.id],
    });
    await completeChallengeRun(ownerId, run.id);

    await expect(getChallengeDecisionRecords(otherUserId)).resolves.toEqual([]);
    await expect(getChallengeDecisionContext(otherUserId, decision.id)).resolves.toBeNull();
  });
});
