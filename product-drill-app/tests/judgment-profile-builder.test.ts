/**
 * Issue #6 — buildJudgmentProfile 纯函数测试
 *
 * 验收：
 * - 移除 totalScore / 雷达图 / 技能次数推断
 * - 每条结论可追溯具体 decision_event_id
 * - 证据不足时不显示伪精确分数
 * - 辅助证据 / 迁移证据 / 同世界修正状态可区分
 */
import { describe, expect, it } from "vitest";
import {
  buildJudgmentProfile,
  getConfidenceLabel,
  type JudgmentProfileInput,
  type HypothesisDisplayItem,
} from "../src/lib/judgment-profile-builder";
import type { JudgmentHypothesis, HypothesisEvidence } from "../src/lib/causal-world";

// ── fixtures ──────────────────────────────────────────────────────

function makeHypothesis(
  override: Partial<JudgmentHypothesis> = {}
): JudgmentHypothesis {
  return {
    id: "hyp-001",
    user_id: "user-001",
    habit_name: "premature_solution_commitment",
    trigger_conditions: ["feature request", "stakeholder pressure"],
    confidence: "low",
    supporting_evidence_ids: [],
    counter_evidence_ids: [],
    last_updated_at: "2026-07-23T00:00:00.000Z",
    created_at: "2026-07-23T00:00:00.000Z",
    ...override,
  };
}

function makeEvidence(
  type: HypothesisEvidence["evidence_type"],
  override: Partial<HypothesisEvidence> = {}
): HypothesisEvidence {
  return {
    id: `ev-${Math.random().toString(36).slice(2)}`,
    hypothesis_id: "hyp-001",
    decision_event_id: "dec-001",
    evidence_type: type,
    world_id: "world-1",
    world_version: "1.0.0",
    model_version: "gpt-4o:v1",
    transfer_world_id: null,
    created_at: "2026-07-23T00:00:00.000Z",
    ...override,
  };
}

// ── buildJudgmentProfile ──────────────────────────────────────────

describe("buildJudgmentProfile", () => {
  it("returns an empty items array when hypotheses list is empty", () => {
    const result = buildJudgmentProfile({ hypotheses: [], evidence: [] });
    expect(result.items).toHaveLength(0);
  });

  it("maps each hypothesis to one display item", () => {
    const result = buildJudgmentProfile({
      hypotheses: [makeHypothesis(), makeHypothesis({ id: "hyp-002", habit_name: "habit-2" })],
      evidence: [],
    });
    expect(result.items).toHaveLength(2);
  });

  it("never includes a numeric score field", () => {
    const result = buildJudgmentProfile({
      hypotheses: [makeHypothesis({ confidence: "high" })],
      evidence: [makeEvidence("supporting")],
    });
    for (const item of result.items) {
      expect(item).not.toHaveProperty("score");
      expect(item).not.toHaveProperty("totalScore");
      expect(item).not.toHaveProperty("skillScore");
    }
  });

  it("shows 'insufficient' label when confidence is insufficient", () => {
    const result = buildJudgmentProfile({
      hypotheses: [makeHypothesis({ confidence: "insufficient" })],
      evidence: [],
    });
    const item = result.items[0];
    expect(item.confidence_label).toBe("证据不足");
    expect(item.show_confidence_as_score).toBe(false);
  });

  it("does not show confidence as a score for any confidence level", () => {
    for (const conf of ["high", "medium", "low", "insufficient"] as const) {
      const result = buildJudgmentProfile({
        hypotheses: [makeHypothesis({ confidence: conf })],
        evidence: [],
      });
      expect(result.items[0].show_confidence_as_score).toBe(false);
    }
  });

  it("groups evidence by type under each hypothesis", () => {
    const hyp = makeHypothesis({ supporting_evidence_ids: ["ev-1"], counter_evidence_ids: ["ev-2"] });
    const ev1 = makeEvidence("supporting", { id: "ev-1", decision_event_id: "dec-A" });
    const ev2 = makeEvidence("counter", { id: "ev-2", decision_event_id: "dec-B" });
    const result = buildJudgmentProfile({ hypotheses: [hyp], evidence: [ev1, ev2] });

    const item = result.items[0];
    expect(item.supporting_evidence).toHaveLength(1);
    expect(item.counter_evidence).toHaveLength(1);
    expect(item.supporting_evidence[0].decision_event_id).toBe("dec-A");
    expect(item.counter_evidence[0].decision_event_id).toBe("dec-B");
  });

  it("marks assisted evidence separately — it does NOT appear in supporting or counter lists", () => {
    const ev = makeEvidence("assisted", { id: "ev-assisted" });
    const result = buildJudgmentProfile({
      hypotheses: [makeHypothesis()],
      evidence: [ev],
    });
    const item = result.items[0];
    expect(item.assisted_evidence).toHaveLength(1);
    expect(item.supporting_evidence).toHaveLength(0);
    expect(item.counter_evidence).toHaveLength(0);
  });

  it("marks transfer evidence with transfer_world_id and is_transfer=true", () => {
    const ev = makeEvidence("transfer", {
      id: "ev-transfer",
      world_id: "world-3",
      transfer_world_id: "world-3",
      decision_event_id: "dec-transfer",
    });
    const result = buildJudgmentProfile({
      hypotheses: [makeHypothesis()],
      evidence: [ev],
    });
    const item = result.items[0];
    expect(item.transfer_evidence).toHaveLength(1);
    expect(item.transfer_evidence[0].is_transfer).toBe(true);
    expect(item.transfer_evidence[0].transfer_world_id).toBe("world-3");
  });

  it("each evidence item exposes decision_event_id for deep-link", () => {
    const ev = makeEvidence("supporting", { decision_event_id: "dec-XYZ" });
    const result = buildJudgmentProfile({
      hypotheses: [makeHypothesis()],
      evidence: [ev],
    });
    const evItem = result.items[0].supporting_evidence[0];
    expect(evItem.decision_event_id).toBe("dec-XYZ");
  });

  it("exposes world_id, world_version, model_version for traceability", () => {
    const ev = makeEvidence("supporting", {
      world_id: "world-2",
      world_version: "2.0.0",
      model_version: "gpt-4o:v2",
    });
    const result = buildJudgmentProfile({
      hypotheses: [makeHypothesis()],
      evidence: [ev],
    });
    const evItem = result.items[0].supporting_evidence[0];
    expect(evItem.world_id).toBe("world-2");
    expect(evItem.world_version).toBe("2.0.0");
    expect(evItem.model_version).toBe("gpt-4o:v2");
  });

  it("identifies same-world correction (no transfer_world_id, evidence_type != transfer)", () => {
    const ev = makeEvidence("supporting", { world_id: "world-1", transfer_world_id: null });
    const result = buildJudgmentProfile({
      hypotheses: [makeHypothesis()],
      evidence: [ev],
    });
    const evItem = result.items[0].supporting_evidence[0];
    expect(evItem.is_transfer).toBe(false);
    expect(evItem.is_same_world_correction).toBe(false); // supporting from same world is not "correction"
  });

  it("flags same_world_correction for counter evidence from the same world", () => {
    const ev = makeEvidence("counter", { world_id: "world-1", transfer_world_id: null });
    const result = buildJudgmentProfile({
      hypotheses: [makeHypothesis()],
      evidence: [ev],
    });
    const evItem = result.items[0].counter_evidence[0];
    // counter evidence in the same world = same-world correction opportunity
    expect(evItem.is_same_world_correction).toBe(true);
    expect(evItem.is_transfer).toBe(false);
  });

  it("summary counts are correct", () => {
    const ev1 = makeEvidence("supporting", { id: "ev-1" });
    const ev2 = makeEvidence("counter", { id: "ev-2" });
    const ev3 = makeEvidence("assisted", { id: "ev-3" });
    const ev4 = makeEvidence("transfer", { id: "ev-4", transfer_world_id: "world-3" });
    const result = buildJudgmentProfile({
      hypotheses: [makeHypothesis()],
      evidence: [ev1, ev2, ev3, ev4],
    });
    const item = result.items[0];
    expect(item.supporting_evidence).toHaveLength(1);
    expect(item.counter_evidence).toHaveLength(1);
    expect(item.assisted_evidence).toHaveLength(1);
    expect(item.transfer_evidence).toHaveLength(1);
    expect(item.total_evidence_count).toBe(4);
  });
});

// ── getConfidenceLabel ────────────────────────────────────────────

describe("getConfidenceLabel", () => {
  it("returns '证据不足' for insufficient", () => {
    expect(getConfidenceLabel("insufficient")).toBe("证据不足");
  });

  it("returns human-readable label for each confidence level", () => {
    expect(getConfidenceLabel("high")).toBeTruthy();
    expect(getConfidenceLabel("medium")).toBeTruthy();
    expect(getConfidenceLabel("low")).toBeTruthy();
  });

  it("all labels are non-empty strings", () => {
    for (const c of ["high", "medium", "low", "insufficient"] as const) {
      const label = getConfidenceLabel(c);
      expect(typeof label).toBe("string");
      expect(label.length).toBeGreaterThan(0);
    }
  });
});
