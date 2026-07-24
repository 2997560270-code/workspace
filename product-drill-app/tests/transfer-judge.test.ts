import { describe, expect, it } from "vitest";
import {
  judgeTransferEvidence,
  isIndependentTransferDecision,
  type TransferJudgmentInput,
} from "../src/lib/transfer-judge";
import type { HypothesisEvidence, Intervention } from "../src/lib/causal-world";

// ── fixtures ──────────────────────────────────────────────────────
function makeEvidence(
  override: Partial<HypothesisEvidence> = {}
): HypothesisEvidence {
  return {
    id: "hyp-ev-001",
    hypothesis_id: "hyp-001",
    decision_event_id: "dec-001",
    evidence_type: "supporting",
    world_id: "world-3",
    world_version: "1.0.0",
    model_version: "gpt-4o",
    transfer_world_id: null,
    created_at: new Date().toISOString(),
    ...override,
  };
}

function makeIntervention(
  type: Intervention["intervention_type"],
  runId = "run-003"
): Intervention {
  return {
    id: `int-${Math.random()}`,
    run_id: runId,
    decision_event_id: null,
    intervention_type: type,
    content: "hint content",
    model_version: "gpt-4o",
    world_version: "1.0.0",
    triggered_at: new Date(Date.now() - 5000).toISOString(),
  };
}

// ── isIndependentTransferDecision ─────────────────────────────────
describe("isIndependentTransferDecision", () => {
  it("returns true when no hints were given in the transfer run", () => {
    const noHints: Intervention[] = [makeIntervention("feedback")];
    expect(isIndependentTransferDecision("run-003", noHints)).toBe(true);
  });

  it("returns false when any hint was given in the transfer run", () => {
    const withHint: Intervention[] = [makeIntervention("hint", "run-003")];
    expect(isIndependentTransferDecision("run-003", withHint)).toBe(false);
  });

  it("ignores hints from other runs", () => {
    const hintOtherRun: Intervention[] = [makeIntervention("hint", "run-OTHER")];
    expect(isIndependentTransferDecision("run-003", hintOtherRun)).toBe(true);
  });
});

// ── judgeTransferEvidence ─────────────────────────────────────────
describe("judgeTransferEvidence", () => {
  const baseInput: TransferJudgmentInput = {
    training_world_ids: ["world-1", "world-2"],
    transfer_world_id: "world-3",
    decision_run_id: "run-003",
    evidence: makeEvidence({ world_id: "world-3", evidence_type: "supporting" }),
    interventions_in_run: [],
    observation_confidence: "medium",
  };

  it("qualifies as transfer evidence when world is unfamiliar and decision is independent", () => {
    const result = judgeTransferEvidence(baseInput);
    expect(result.qualifies_as_transfer).toBe(true);
    expect(result.evidence_type).toBe("transfer");
    expect(result.reason.length).toBeGreaterThan(0);
  });

  it("does NOT qualify when decision was assisted by a hint", () => {
    const input: TransferJudgmentInput = {
      ...baseInput,
      interventions_in_run: [makeIntervention("hint", "run-003")],
    };
    const result = judgeTransferEvidence(input);
    expect(result.qualifies_as_transfer).toBe(false);
    expect(result.evidence_type).toBe("assisted");
  });

  it("does NOT qualify when the world is one of the training worlds (not novel)", () => {
    const input: TransferJudgmentInput = {
      ...baseInput,
      transfer_world_id: "world-1", // already a training world
      evidence: makeEvidence({ world_id: "world-1" }),
    };
    const result = judgeTransferEvidence(input);
    expect(result.qualifies_as_transfer).toBe(false);
  });

  it("does NOT qualify when observation_confidence is low", () => {
    const input: TransferJudgmentInput = {
      ...baseInput,
      observation_confidence: "low",
    };
    const result = judgeTransferEvidence(input);
    expect(result.qualifies_as_transfer).toBe(false);
  });

  it("does NOT qualify when observation_confidence is insufficient", () => {
    const input: TransferJudgmentInput = {
      ...baseInput,
      observation_confidence: "insufficient",
    };
    const result = judgeTransferEvidence(input);
    expect(result.qualifies_as_transfer).toBe(false);
  });

  it("returns a non-empty reason in all cases", () => {
    const cases: TransferJudgmentInput[] = [
      baseInput,
      { ...baseInput, interventions_in_run: [makeIntervention("hint", "run-003")] },
      { ...baseInput, observation_confidence: "low" },
    ];
    for (const c of cases) {
      const result = judgeTransferEvidence(c);
      expect(result.reason.length).toBeGreaterThan(0);
    }
  });

  it("sets transfer_world_id on the evidence record when transfer qualifies", () => {
    const result = judgeTransferEvidence(baseInput);
    if (result.qualifies_as_transfer) {
      expect(result.updated_evidence.transfer_world_id).toBe("world-3");
    }
  });
});
