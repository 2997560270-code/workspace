import { describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/ai/causal-pipeline", () => ({
  observeBehavior: async (params: {
    decisionEvent: { evidence_basis: string[] };
    eventHistory: Array<{ id: string; payload: Record<string, unknown> }>;
    wasAssisted: boolean;
  }) => ({
    observations: params.decisionEvent.evidence_basis.map((eventId) => {
      const event = params.eventHistory.find((candidate) => candidate.id === eventId)!;
      const dimension = event.payload.discovery_dimension as "workflow" | "consequence" | "alternative";
      return {
        behavior_code: `DISCOVERY_${dimension.toUpperCase()}`,
        description: `Covered ${dimension}`,
        evidence_event_ids: [eventId],
        evidence_quotes: [String(event.payload.text)],
        dimension_covered: dimension,
      };
    }),
    missing_dimensions: [],
    assisted: params.wasAssisted,
    confidence: "medium" as const,
    insufficient_reason: null,
    model_version: "deepseek-test:v1",
  }),
  updateHypothesis: async (params: {
    habitName: string;
    behaviorObservation: { observations: Array<{ evidence_event_ids: string[] }> };
  }) => ({
    habit_name: params.habitName,
    update_direction: "contradicts" as const,
    updated_confidence: "low" as const,
    rationale: "All governed dimensions were covered.",
    referenced_evidence_ids: params.behaviorObservation.observations.flatMap(
      (observation) => observation.evidence_event_ids
    ),
    applicable_trigger_conditions: [],
    forbidden_inferences_confirmed: [],
    model_version: "deepseek-test:v1",
  }),
}));

import { evaluateChallengeDecision } from "../src/lib/challenge-evaluation";
import {
  appendWorldEvent,
  getHypothesisEvidenceForProfile,
  insertChallengeRun,
  insertDecisionEvent,
} from "../src/lib/repositories/challenge-repository";
import { getDemoWorld } from "../src/lib/world-seeds";

describe("formal challenge evaluation", () => {
  it("persists traceable evidence only when both model stages are formal", async () => {
    const userId = `formal-evaluation-${crypto.randomUUID()}`;
    const world = getDemoWorld("world-1-ai-summary")!;
    const run = await insertChallengeRun(
      userId,
      world.world_id,
      world.version.version,
      "deepseek-test:v1"
    );
    const dimensions = ["workflow", "consequence", "alternative"] as const;
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
    const decision = await insertDecisionEvent({
      userId,
      runId: run.id,
      worldEventId: events[0].id,
      judgment: "Validate before committing",
      chosenAction: "Run governed discovery",
      expectedOutcome: "Resolve uncertainty",
      confidence: "medium",
      rejectedAlternatives: [],
      evidenceBasis: events.map((event) => event.id),
    });

    const result = await evaluateChallengeDecision({
      userId,
      runId: run.id,
      decisionEventId: decision.id,
    });

    expect(result.formal).toBe(true);
    expect(result.degraded).toBe(false);
    expect(result.evidence).toMatchObject({
      decision_event_id: decision.id,
      evidence_type: "counter",
      model_version: "deepseek-test:v1",
    });
    const evidence = await getHypothesisEvidenceForProfile([result.hypothesis.id]);
    expect(evidence).toHaveLength(1);
  });
});
