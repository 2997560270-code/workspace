import { describe, expect, it } from "vitest";
import {
  BehaviorObservationSchema,
  HypothesisUpdateSchema,
  WorldNarratorOutputSchema,
} from "../src/lib/ai/causal-schemas";

// ── WorldNarratorOutputSchema ─────────────────────────────────────
describe("WorldNarratorOutputSchema", () => {
  it("accepts valid narration output", () => {
    const result = WorldNarratorOutputSchema.safeParse({
      narration: "角色回应了你的问题。",
      revealed_fact_ids: ["HF-1-02"],
      state_changed: true,
      state_change_summary: "揭示了使用率数据",
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty revealed_fact_ids", () => {
    const result = WorldNarratorOutputSchema.safeParse({
      narration: "角色未透露新信息。",
      revealed_fact_ids: [],
      state_changed: false,
      state_change_summary: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty narration", () => {
    const result = WorldNarratorOutputSchema.safeParse({
      narration: "",
      revealed_fact_ids: [],
      state_changed: false,
      state_change_summary: null,
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than 5 revealed fact ids", () => {
    const result = WorldNarratorOutputSchema.safeParse({
      narration: "回应",
      revealed_fact_ids: ["a", "b", "c", "d", "e", "f"],
      state_changed: true,
      state_change_summary: "too many",
    });
    expect(result.success).toBe(false);
  });
});

// ── BehaviorObservationSchema ─────────────────────────────────────
describe("BehaviorObservationSchema", () => {
  const validObservation = {
    observations: [
      {
        behavior_code: "E-02",
        description: "跳过三个维度直接承诺",
        evidence_event_ids: ["evt-1"],
        evidence_quotes: ["直接上线吧"],
        dimension_covered: "none",
      },
    ],
    missing_dimensions: ["workflow", "consequence", "alternative"],
    assisted: false,
    confidence: "low",
    insufficient_reason: "未覆盖任何维度",
  };

  it("accepts valid observation", () => {
    expect(BehaviorObservationSchema.safeParse(validObservation).success).toBe(true);
  });

  it("rejects observation with empty evidence_event_ids", () => {
    const result = BehaviorObservationSchema.safeParse({
      ...validObservation,
      observations: [
        {
          ...validObservation.observations[0],
          evidence_event_ids: [], // min(1) 要求至少一个
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid dimension_covered value", () => {
    const result = BehaviorObservationSchema.safeParse({
      ...validObservation,
      observations: [
        {
          ...validObservation.observations[0],
          dimension_covered: "budget", // 不在枚举中
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid confidence value", () => {
    const result = BehaviorObservationSchema.safeParse({
      ...validObservation,
      confidence: "very-high",
    });
    expect(result.success).toBe(false);
  });

  it("accepts empty observations array", () => {
    const result = BehaviorObservationSchema.safeParse({
      observations: [],
      missing_dimensions: [],
      assisted: false,
      confidence: "high",
      insufficient_reason: null,
    });
    expect(result.success).toBe(true);
  });
});

// ── HypothesisUpdateSchema ────────────────────────────────────────
describe("HypothesisUpdateSchema", () => {
  const validUpdate = {
    habit_name: "premature_solution_commitment",
    update_direction: "supports",
    updated_confidence: "low",
    rationale: "未覆盖三个维度即承诺，基于 evt-1 的证据。",
    referenced_evidence_ids: ["evt-1"],
    applicable_trigger_conditions: ["T-01"],
    forbidden_inferences_confirmed: [
      "overall_PM_competency",
      "hiring_fit",
      "permanent_trait",
    ],
  };

  it("accepts valid hypothesis update", () => {
    expect(HypothesisUpdateSchema.safeParse(validUpdate).success).toBe(true);
  });

  it("rejects invalid update_direction", () => {
    const result = HypothesisUpdateSchema.safeParse({
      ...validUpdate,
      update_direction: "unknown",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid updated_confidence", () => {
    const result = HypothesisUpdateSchema.safeParse({
      ...validUpdate,
      updated_confidence: "certain",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty rationale", () => {
    const result = HypothesisUpdateSchema.safeParse({
      ...validUpdate,
      rationale: "",
    });
    expect(result.success).toBe(false);
  });

  it("accepts insufficient direction with no evidence", () => {
    const result = HypothesisUpdateSchema.safeParse({
      ...validUpdate,
      update_direction: "insufficient",
      updated_confidence: "insufficient",
      referenced_evidence_ids: [],
    });
    expect(result.success).toBe(true);
  });
});
