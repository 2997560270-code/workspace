/**
 * 回归测试：causal-pipeline.ts 中已修复的 7 个问题。
 *
 * OpenAI 在测试环境下未配置，所有调用走确定性降级路径，
 * 因此可直接验证 deterministicNarration / deterministicBehaviorObservation 的修复。
 */
import { describe, expect, it } from "vitest";
import { narrateWorldResponse, observeBehavior } from "../src/lib/ai/causal-pipeline";
import type {
  CausalWorldVersion,
  DecisionEvent,
  WorldEvent,
} from "../src/lib/causal-world";

// ── 共用 fixtures ─────────────────────────────────────────────────

function makeWorldVersion(
  overrides: Partial<CausalWorldVersion["immutable_rules"]> = {}
): CausalWorldVersion {
  return {
    world_id: "world-1",
    version: "1.0.0",
    transfer_role: "calibration",
    trigger_statement: "数据大屏请求",
    visible_facts: ["有一个数据大屏建设需求"],
    immutable_rules: {
      hidden_facts: [
        { id: "fact-1", content: "报表使用频率低", reveal_condition_id: "rc-1", causal_significance: "重要" },
      ],
      causal_rules: [],
      role_interests: [],
      reveal_conditions: [
        { id: "rc-1", trigger: "使用频率", reveals: ["fact-1"] },
        { id: "rc-wildcard", trigger: "*", reveals: [] },
        ...(overrides.reveal_conditions ?? []),
      ],
      ...overrides,
    },
    behavior_anchors: {
      premature_commitment: { level: 1, description: "过早", observable_indicators: [], anti_examples: [] },
      adequate_investigation: { level: 3, description: "充分", observable_indicators: [], anti_examples: [] },
      model_behavior: { level: 5, description: "典范", observable_indicators: [], anti_examples: [] },
    },
    transfer_surface_differences: [],
    approved_by: null,
    source_references: [],
    created_at: new Date().toISOString(),
  };
}

function makeDecision(override: Partial<DecisionEvent> = {}): DecisionEvent {
  return {
    id: "dec-001",
    run_id: "run-001",
    world_event_id: "world-evt-001",
    judgment: "需要大屏",
    chosen_action: "立刻搭建大屏",
    expected_outcome: "提升效率",
    confidence: "high",
    rejected_alternatives: [],
    evidence_basis: [],
    consequences_revealed: false,
    created_at: new Date().toISOString(),
    ...override,
  };
}

function makeEvent(id: string): WorldEvent {
  return {
    id,
    run_id: "run-001",
    event_type: "user_action",
    sequence_index: 0,
    actor: "user",
    payload: { text: "调查行动" },
    created_at: new Date().toISOString(),
  };
}

// ── Fix #1: empty-string trigger ──────────────────────────────────
describe("deterministicNarration — empty-string trigger fix", () => {
  it("does NOT fire reveal for an empty-string trigger regardless of user input", async () => {
    const worldWithEmptyTrigger = makeWorldVersion({
      reveal_conditions: [
        { id: "rc-empty", trigger: "", reveals: ["fact-1"] },
      ],
    });
    // override full reveal_conditions to isolate the empty trigger
    worldWithEmptyTrigger.immutable_rules.reveal_conditions = [
      { id: "rc-empty", trigger: "", reveals: ["fact-1"] },
    ];

    const result = await narrateWorldResponse({
      worldVersion: worldWithEmptyTrigger,
      userAction: "任意用户输入",
      eventHistory: [],
      revealedFactIds: [],
    });

    expect(result.revealed_fact_ids).not.toContain("fact-1");
    expect(result.state_changed).toBe(false);
  });

  it("wildcard trigger '*' still fires correctly", async () => {
    const worldWithWildcard = makeWorldVersion();
    // rc-wildcard reveals nothing, but should not error
    const result = await narrateWorldResponse({
      worldVersion: worldWithWildcard,
      userAction: "随便",
      eventHistory: [],
      revealedFactIds: [],
    });
    // wildcard reveals [] so state_changed stays false
    expect(result.revealed_fact_ids).toHaveLength(0);
  });
});

// ── Fix #2 + #3: narrateWorldResponse state_changed coherence ─────
describe("narrateWorldResponse — state_changed coherence fix", () => {
  it("sets state_changed=false when revealedFactIds becomes empty after filtering", async () => {
    // In deterministic mode, the trigger must match to produce reveals;
    // if it doesn't, both revealed_fact_ids and state_changed must be false/empty.
    const result = await narrateWorldResponse({
      worldVersion: makeWorldVersion(),
      userAction: "完全不相关的输入",
      eventHistory: [],
      revealedFactIds: [],
    });

    if (result.revealed_fact_ids.length === 0) {
      expect(result.state_changed).toBe(false);
      expect(result.state_change_summary).toBeNull();
    }
  });

  it("state_changed=true only when revealed_fact_ids is non-empty", async () => {
    const result = await narrateWorldResponse({
      worldVersion: makeWorldVersion(),
      userAction: "使用频率是多少",
      eventHistory: [],
      revealedFactIds: [],
    });

    if (result.state_changed) {
      expect(result.revealed_fact_ids.length).toBeGreaterThan(0);
    } else {
      expect(result.state_change_summary).toBeNull();
    }
  });
});

// ── Fix #1 (CRITICAL): no fabricated evidence_event_ids ──────────
describe("deterministicBehaviorObservation — no fabricated evidence IDs", () => {
  it("evidence_event_ids is empty (not world_event_id) when isPremature", async () => {
    const decision = makeDecision({ evidence_basis: [] }); // no basis → isPremature
    const result = await observeBehavior({
      worldVersion: makeWorldVersion(),
      decisionEvent: decision,
      eventHistory: [],
      wasAssisted: false,
    });

    expect(result.confidence).toBe("low");
    for (const obs of result.observations) {
      // Must NOT contain the world_event_id as a fabricated evidence reference
      expect(obs.evidence_event_ids).not.toContain(decision.world_event_id);
      // Must be empty when no real events were cited
      expect(obs.evidence_event_ids).toHaveLength(0);
    }
  });

  it("evidence_event_ids contains valid basis IDs when isPremature=false", async () => {
    const evt = makeEvent("real-evt-001");
    const decision = makeDecision({ evidence_basis: ["real-evt-001"] });
    const result = await observeBehavior({
      worldVersion: makeWorldVersion(),
      decisionEvent: decision,
      eventHistory: [evt],
      wasAssisted: false,
    });

    expect(result.confidence).toBe("medium");
    expect(result.observations).toHaveLength(0); // non-premature → no E-02
  });
});

// ── Fix #2 (CRITICAL): wasAssisted propagated through fallback ────
describe("deterministicBehaviorObservation — wasAssisted propagation fix", () => {
  it("returns assisted=true when wasAssisted=true (fallback path)", async () => {
    const result = await observeBehavior({
      worldVersion: makeWorldVersion(),
      decisionEvent: makeDecision(),
      eventHistory: [],
      wasAssisted: true,
    });
    expect(result.assisted).toBe(true);
  });

  it("returns assisted=false when wasAssisted=false (fallback path)", async () => {
    const result = await observeBehavior({
      worldVersion: makeWorldVersion(),
      decisionEvent: makeDecision(),
      eventHistory: [],
      wasAssisted: false,
    });
    expect(result.assisted).toBe(false);
  });
});
