/**
 * Issue #14 — 失败行为与降级契约回归测试
 *
 * 覆盖：无效证据 ID、拒答/降级、确定性 fallback 的证据边界。
 * OpenAI 未配置时所有 AI 调用走确定性降级，本文件验证降级不破坏证据合约。
 * 可在 CI 重复运行。
 */
import { describe, expect, it } from "vitest";
import { observeBehavior, updateHypothesis } from "../src/lib/ai/causal-pipeline";
import type { CausalWorldVersion, DecisionEvent, WorldEvent } from "../src/lib/causal-world";

// ── 固定装置 ──────────────────────────────────────────────────────
function worldVersion(): CausalWorldVersion {
  return {
    world_id: "world-1",
    version: "1.0.0",
    transfer_role: "calibration",
    trigger_statement: "触发情境",
    visible_facts: [],
    immutable_rules: {
      hidden_facts: [],
      causal_rules: [],
      role_interests: [],
      reveal_conditions: [],
    },
    behavior_anchors: {
      premature_commitment: { level: 1, description: "", observable_indicators: [], anti_examples: [] },
      adequate_investigation: { level: 3, description: "", observable_indicators: [], anti_examples: [] },
      model_behavior: { level: 5, description: "", observable_indicators: [], anti_examples: [] },
    },
    transfer_surface_differences: [],
    approved_by: null,
    source_references: [],
    created_at: "2026-07-24T00:00:00.000Z",
  };
}

function decision(override: Partial<DecisionEvent> = {}): DecisionEvent {
  return {
    id: "dec-1",
    run_id: "run-1",
    world_event_id: "world-evt-1",
    judgment: "j",
    chosen_action: "a",
    expected_outcome: "o",
    confidence: "high",
    rejected_alternatives: [],
    evidence_basis: [],
    consequences_revealed: false,
    created_at: "2026-07-24T00:00:00.000Z",
    ...override,
  };
}

function event(id: string): WorldEvent {
  return {
    id,
    run_id: "run-1",
    event_type: "user_action",
    sequence_index: 0,
    actor: "user",
    payload: {},
    created_at: "2026-07-24T00:00:00.000Z",
  };
}

// ── 降级契约：无证据决策 ──────────────────────────────────────────
describe("deterministic fallback — premature decision (no evidence)", () => {
  it("returns low confidence and does NOT fabricate evidence IDs", async () => {
    const obs = await observeBehavior({
      worldVersion: worldVersion(),
      decisionEvent: decision({ evidence_basis: [] }),
      eventHistory: [],
      wasAssisted: false,
    });

    expect(obs.confidence).toBe("low");
    // 关键边界：evidence_event_ids 不得伪造 world_event_id
    for (const o of obs.observations) {
      expect(o.evidence_event_ids).not.toContain("world-evt-1");
      expect(o.evidence_event_ids).toHaveLength(0);
    }
  });

  it("insufficient confidence downgrades hypothesis to insufficient", async () => {
    const obs = await observeBehavior({
      worldVersion: worldVersion(),
      decisionEvent: decision({ evidence_basis: [] }),
      eventHistory: [],
      wasAssisted: false,
    });
    const update = await updateHypothesis({
      habitName: "premature_solution_commitment",
      currentConfidence: "insufficient",
      currentTriggerConditions: [],
      behaviorObservation: obs,
      worldId: "world-1",
      worldVersion: "1.0.0",
      isTransferWorld: false,
    });
    expect(update.update_direction).toBe("insufficient");
    expect(update.updated_confidence).toBe("insufficient");
  });
});

// ── 降级契约：辅助状态传播 ────────────────────────────────────────
describe("deterministic fallback — assisted status propagation", () => {
  it("wasAssisted=true propagates to observation.assisted", async () => {
    const obs = await observeBehavior({
      worldVersion: worldVersion(),
      decisionEvent: decision(),
      eventHistory: [],
      wasAssisted: true,
    });
    expect(obs.assisted).toBe(true);
  });
});

// ── 降级契约：确定性输出稳定可重复 ────────────────────────────────
describe("deterministic fallback — repeatable output", () => {
  it("same input yields same confidence across repeated calls", async () => {
    const results = await Promise.all(
      Array.from({ length: 3 }, () =>
        observeBehavior({
          worldVersion: worldVersion(),
          decisionEvent: decision({ evidence_basis: ["real-evt"] }),
          eventHistory: [event("real-evt")],
          wasAssisted: false,
        })
      )
    );
    const confidences = results.map((r) => r.confidence);
    expect(new Set(confidences).size).toBe(1);
  });

  it("model_version marks output as deterministic (unofficial)", async () => {
    const obs = await observeBehavior({
      worldVersion: worldVersion(),
      decisionEvent: decision(),
      eventHistory: [],
      wasAssisted: false,
    });
    expect(obs.model_version).toBe("deterministic-v1");
  });
});

// ── 降级契约：好行为提升假设置信度 ────────────────────────────────
describe("deterministic fallback — good behavior weakens habit hypothesis", () => {
  it("all dimensions covered (contradicts) → confidence stays low, not medium", async () => {
    // evidence_basis 引用真实事件 → 非过早 → medium 观察置信度
    const obs = await observeBehavior({
      worldVersion: worldVersion(),
      decisionEvent: decision({ evidence_basis: ["real-evt"] }),
      eventHistory: [event("real-evt")],
      wasAssisted: false,
    });
    const update = await updateHypothesis({
      habitName: "premature_solution_commitment",
      currentConfidence: "low",
      currentTriggerConditions: [],
      behaviorObservation: obs,
      worldId: "world-1",
      worldVersion: "1.0.0",
      isTransferWorld: false,
    });
    // 好行为反驳"有过早承诺习惯"的假设 → contradicts → 置信度降为 low
    expect(update.update_direction).toBe("contradicts");
    expect(update.updated_confidence).toBe("low");
  });
});
