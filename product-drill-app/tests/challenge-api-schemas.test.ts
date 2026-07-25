import { describe, expect, it } from "vitest";
import {
  CreateChallengeRunBodySchema,
  AppendActionBodySchema,
  CreateDecisionBodySchema,
  RevealConsequencesBodySchema,
  CreateInterventionBodySchema,
} from "../src/lib/api/challenge-schemas";

describe("CreateChallengeRunBodySchema", () => {
  it("accepts valid world_id and world_version", () => {
    const result = CreateChallengeRunBodySchema.safeParse({
      world_id: "world-1",
      world_version: "1.0.0",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty world_id", () => {
    const result = CreateChallengeRunBodySchema.safeParse({
      world_id: "",
      world_version: "1.0.0",
    });
    expect(result.success).toBe(false);
  });
});

describe("AppendActionBodySchema", () => {
  it("accepts valid action", () => {
    const result = AppendActionBodySchema.safeParse({
      sequence_index: 0,
      actor: "user",
      event_type: "user_action",
      payload: { text: "你们能做吗？" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative sequence_index", () => {
    const result = AppendActionBodySchema.safeParse({
      sequence_index: -1,
      actor: "user",
      event_type: "user_action",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid actor", () => {
    const result = AppendActionBodySchema.safeParse({
      sequence_index: 0,
      actor: "admin",
      event_type: "user_action",
    });
    expect(result.success).toBe(false);
  });

  it("defaults payload to empty object", () => {
    const result = AppendActionBodySchema.safeParse({
      sequence_index: 0,
      actor: "world",
      event_type: "world_response",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.payload).toEqual({});
  });
});

describe("CreateDecisionBodySchema", () => {
  const valid = {
    world_event_id: "evt-1",
    judgment: "过早承诺",
    chosen_action: "直接承诺",
    expected_outcome: "CEO满意",
    confidence: "high" as const,
    rejected_alternatives: ["先调查"],
    evidence_basis: ["evt-0"],
  };

  it("accepts valid decision", () => {
    expect(CreateDecisionBodySchema.safeParse(valid).success).toBe(true);
  });

  it("rejects invalid confidence value", () => {
    const result = CreateDecisionBodySchema.safeParse({ ...valid, confidence: "very-high" });
    expect(result.success).toBe(false);
  });

  it("rejects empty judgment", () => {
    const result = CreateDecisionBodySchema.safeParse({ ...valid, judgment: "" });
    expect(result.success).toBe(false);
  });

  it("defaults arrays to empty", () => {
    const result = CreateDecisionBodySchema.safeParse({
      world_event_id: "evt-1",
      judgment: "j",
      chosen_action: "a",
      expected_outcome: "o",
      confidence: "low",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rejected_alternatives).toEqual([]);
      expect(result.data.evidence_basis).toEqual([]);
    }
  });
});

describe("RevealConsequencesBodySchema", () => {
  it("accepts valid decision_event_id", () => {
    expect(
      RevealConsequencesBodySchema.safeParse({ decision_event_id: "dec-1" }).success
    ).toBe(true);
  });

  it("rejects empty decision_event_id", () => {
    expect(
      RevealConsequencesBodySchema.safeParse({ decision_event_id: "" }).success
    ).toBe(false);
  });
});

describe("CreateInterventionBodySchema", () => {
  it("accepts valid hint intervention", () => {
    const result = CreateInterventionBodySchema.safeParse({
      decision_event_id: "dec-1",
      intervention_type: "hint",
      content: "先问一下使用数据",
    });
    expect(result.success).toBe(true);
  });

  it("accepts null decision_event_id", () => {
    const result = CreateInterventionBodySchema.safeParse({
      decision_event_id: null,
      intervention_type: "reveal_consequence",
      content: "后果揭示",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.decision_event_id).toBeNull();
  });

  it("rejects invalid intervention_type", () => {
    const result = CreateInterventionBodySchema.safeParse({
      intervention_type: "punishment",
      content: "test",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty content", () => {
    const result = CreateInterventionBodySchema.safeParse({
      intervention_type: "hint",
      content: "",
    });
    expect(result.success).toBe(false);
  });
});
