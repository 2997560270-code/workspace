import { describe, expect, it } from "vitest";
import {
  createChallengeRun,
  createDecisionEvent,
  createHypothesisEvidence,
  createIntervention,
  createWorldEvent,
  isEvidenceTraceable,
  isIndependentEvidence,
  revealConsequences,
  type HypothesisEvidence,
  type Intervention,
} from "../src/lib/causal-world";

// ── createChallengeRun ────────────────────────────────────────────
describe("createChallengeRun", () => {
  it("creates a run with active status and no completed_at", () => {
    const run = createChallengeRun({
      userId: "user-1",
      worldId: "world-1",
      worldVersion: "1.0.0",
      modelVersion: "gpt-4o",
    });
    expect(run.status).toBe("active");
    expect(run.completed_at).toBeNull();
    expect(run.user_id).toBe("user-1");
    expect(run.world_id).toBe("world-1");
    expect(run.world_version).toBe("1.0.0");
    expect(run.id).toMatch(/^run-/);
  });

  it("generates a unique id each call", () => {
    const a = createChallengeRun({ userId: "u", worldId: "w", worldVersion: "1", modelVersion: "m" });
    const b = createChallengeRun({ userId: "u", worldId: "w", worldVersion: "1", modelVersion: "m" });
    expect(a.id).not.toBe(b.id);
  });
});

// ── createWorldEvent ──────────────────────────────────────────────
describe("createWorldEvent", () => {
  it("creates a world event with correct fields", () => {
    const evt = createWorldEvent({
      runId: "run-1",
      eventType: "user_action",
      sequenceIndex: 0,
      actor: "user",
      payload: { text: "你们能做吗？" },
    });
    expect(evt.run_id).toBe("run-1");
    expect(evt.event_type).toBe("user_action");
    expect(evt.sequence_index).toBe(0);
    expect(evt.actor).toBe("user");
    expect(evt.payload).toEqual({ text: "你们能做吗？" });
    expect(evt.id).toMatch(/^evt-/);
  });
});

// ── createDecisionEvent ───────────────────────────────────────────
describe("createDecisionEvent", () => {
  it("creates decision event with consequences_revealed = false", () => {
    const dec = createDecisionEvent({
      runId: "run-1",
      worldEventId: "evt-1",
      judgment: "过早承诺",
      chosenAction: "直接承诺下季度上线",
      expectedOutcome: "CEO满意",
      confidence: "high",
      rejectedAlternatives: ["先调查使用数据"],
      evidenceBasis: ["evt-0"],
    });
    expect(dec.consequences_revealed).toBe(false);
    expect(dec.run_id).toBe("run-1");
    expect(dec.judgment).toBe("过早承诺");
    expect(dec.id).toMatch(/^dec-/);
  });

  it("always initialises consequences_revealed as false regardless of input", () => {
    // 工厂函数不接受 consequences_revealed 参数，确保不可绕过
    const dec = createDecisionEvent({
      runId: "run-1",
      worldEventId: "evt-1",
      judgment: "test",
      chosenAction: "action",
      expectedOutcome: "outcome",
      confidence: "medium",
      rejectedAlternatives: [],
      evidenceBasis: [],
    });
    expect(dec.consequences_revealed).toBe(false);
  });
});

// ── revealConsequences ────────────────────────────────────────────
describe("revealConsequences", () => {
  it("returns a new object with consequences_revealed = true", () => {
    const dec = createDecisionEvent({
      runId: "run-1",
      worldEventId: "evt-1",
      judgment: "test",
      chosenAction: "action",
      expectedOutcome: "outcome",
      confidence: "low",
      rejectedAlternatives: [],
      evidenceBasis: [],
    });
    const revealed = revealConsequences(dec);
    expect(revealed.consequences_revealed).toBe(true);
    expect(dec.consequences_revealed).toBe(false); // 原对象不变（immutability）
    expect(revealed.id).toBe(dec.id);
  });

  it("does not mutate the original decision event", () => {
    const dec = createDecisionEvent({
      runId: "r",
      worldEventId: "e",
      judgment: "j",
      chosenAction: "a",
      expectedOutcome: "o",
      confidence: "high",
      rejectedAlternatives: [],
      evidenceBasis: [],
    });
    const originalRevealed = dec.consequences_revealed;
    revealConsequences(dec);
    expect(dec.consequences_revealed).toBe(originalRevealed);
  });
});

// ── createIntervention ────────────────────────────────────────────
describe("createIntervention", () => {
  it("creates intervention with correct type and run_id", () => {
    const int = createIntervention({
      runId: "run-1",
      decisionEventId: "dec-1",
      interventionType: "hint",
      content: "先问一下使用数据",
      modelVersion: "gpt-4o",
      worldVersion: "1.0.0",
    });
    expect(int.run_id).toBe("run-1");
    expect(int.intervention_type).toBe("hint");
    expect(int.decision_event_id).toBe("dec-1");
    expect(int.id).toMatch(/^int-/);
  });

  it("accepts null decision_event_id for unprompted interventions", () => {
    const int = createIntervention({
      runId: "run-1",
      decisionEventId: null,
      interventionType: "reveal_consequence",
      content: "后果揭示",
      modelVersion: "gpt-4o",
      worldVersion: "1.0.0",
    });
    expect(int.decision_event_id).toBeNull();
  });
});

// ── createHypothesisEvidence ──────────────────────────────────────
describe("createHypothesisEvidence", () => {
  it("creates evidence with required traceability fields", () => {
    const ev = createHypothesisEvidence({
      hypothesisId: "hyp-1",
      decisionEventId: "dec-1",
      evidenceType: "supporting",
      worldId: "world-1",
      worldVersion: "1.0.0",
      modelVersion: "gpt-4o",
    });
    expect(ev.hypothesis_id).toBe("hyp-1");
    expect(ev.decision_event_id).toBe("dec-1");
    expect(ev.evidence_type).toBe("supporting");
    expect(ev.transfer_world_id).toBeNull();
    expect(ev.id).toMatch(/^hyp-ev-/);
  });

  it("sets transfer_world_id when evidence_type is transfer", () => {
    const ev = createHypothesisEvidence({
      hypothesisId: "hyp-1",
      decisionEventId: "dec-2",
      evidenceType: "transfer",
      worldId: "world-3",
      worldVersion: "1.0.0",
      modelVersion: "gpt-4o",
      transferWorldId: "world-1",
    });
    expect(ev.transfer_world_id).toBe("world-1");
  });
});

// ── isEvidenceTraceable ───────────────────────────────────────────
describe("isEvidenceTraceable", () => {
  const base: HypothesisEvidence = {
    id: "hyp-ev-1",
    hypothesis_id: "hyp-1",
    decision_event_id: "dec-1",
    evidence_type: "supporting",
    world_id: "world-1",
    world_version: "1.0.0",
    model_version: "gpt-4o",
    transfer_world_id: null,
    created_at: new Date().toISOString(),
  };

  it("returns true when all traceability fields are present", () => {
    expect(isEvidenceTraceable(base)).toBe(true);
  });

  it("returns false when decision_event_id is empty", () => {
    expect(isEvidenceTraceable({ ...base, decision_event_id: "" })).toBe(false);
  });

  it("returns false when world_version is empty", () => {
    expect(isEvidenceTraceable({ ...base, world_version: "" })).toBe(false);
  });

  it("returns false when model_version is empty", () => {
    expect(isEvidenceTraceable({ ...base, model_version: "" })).toBe(false);
  });
});

// ── isIndependentEvidence ─────────────────────────────────────────
describe("isIndependentEvidence", () => {
  const base: HypothesisEvidence = {
    id: "hyp-ev-1",
    hypothesis_id: "hyp-1",
    decision_event_id: "dec-1",
    evidence_type: "supporting",
    world_id: "world-1",
    world_version: "1.0.0",
    model_version: "gpt-4o",
    transfer_world_id: null,
    created_at: new Date().toISOString(),
  };

  const RUN_ID = "run-1";

  const hint: Intervention = {
    id: "int-1",
    run_id: RUN_ID,
    decision_event_id: null,
    intervention_type: "hint",
    content: "提示",
    model_version: "gpt-4o",
    world_version: "1.0.0",
    triggered_at: new Date().toISOString(),
  };

  it("returns true when no prior hints exist in the run", () => {
    expect(isIndependentEvidence(base, [], RUN_ID)).toBe(true);
  });

  it("returns false when evidence_type is assisted", () => {
    expect(isIndependentEvidence({ ...base, evidence_type: "assisted" }, [], RUN_ID)).toBe(false);
  });

  it("returns false when prior hint exists in same run", () => {
    expect(isIndependentEvidence(base, [hint], RUN_ID)).toBe(false);
  });

  it("returns true when hint is in a different run", () => {
    const otherHint: Intervention = { ...hint, run_id: "run-999" };
    expect(isIndependentEvidence(base, [otherHint], RUN_ID)).toBe(true);
  });
});
