/**
 * 回归测试：causal-pipeline.ts 中已修复的 7 个问题。
 *
 * OpenAI 在测试环境下未配置，所有调用走确定性降级路径，
 * 因此可直接验证 deterministicNarration / deterministicBehaviorObservation 的修复。
 */
import { describe, expect, it } from "vitest";
import { narrateWorldResponse, observeBehavior } from "../src/lib/ai/causal-pipeline";
import { DEMO_WORLDS } from "../src/lib/world-seeds";
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
    target_habit: "premature_solution_commitment",
    domain: "test",
    governance_status: "approved",
    transfer_role: "calibration",
    trigger_statement: "数据大屏请求",
    visible_facts: ["有一个数据大屏建设需求"],
    available_actions: [],
    pressure_context: "test",
    immutable_rules: {
      model_forbidden_to_modify: true,
      hidden_facts: [
        { id: "fact-1", content: "报表使用频率低", reveal_condition_id: "rc-1", causal_significance: "重要" },
      ],
      causal_rules: [],
      role_interests: [],
      reveal_conditions: [
        {
          id: "rc-1",
          trigger: "使用频率",
          aliases: ["用得怎么样", "当前使用情况", "使用情况"],
          reveals: ["fact-1"],
        },
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

function makeEvent(id: string, discoveryDimension?: "workflow" | "consequence" | "alternative"): WorldEvent {
  return {
    id,
    run_id: "run-001",
    event_type: "user_action",
    sequence_index: 0,
    actor: "user",
    payload: { text: "调查行动", ...(discoveryDimension ? { discovery_dimension: discoveryDimension } : {}) },
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

describe("deterministicNarration — natural investigation language", () => {
  it("reveals the same governed fact for a natural-language alias", async () => {
    const result = await narrateWorldResponse({
      worldVersion: makeWorldVersion(),
      userAction: "我想先了解一下用户现在用得怎么样？",
      eventHistory: [],
      revealedFactIds: [],
    });

    expect(result.response_type).toBe("role_reply");
    expect(result.revealed_fact_ids).toEqual(["fact-1"]);
    expect(result.narration).toContain("报表使用频率低");
    expect(result.narration).not.toContain("确定性演示模式");
  });

  it("answers a matched question again after the fact was already revealed", async () => {
    const result = await narrateWorldResponse({
      worldVersion: makeWorldVersion(),
      userAction: "当前使用情况到底如何？",
      eventHistory: [],
      revealedFactIds: ["fact-1"],
    });

    expect(result.response_type).toBe("role_reply");
    expect(result.cited_fact_ids).toEqual(["fact-1"]);
    expect(result.revealed_fact_ids).toEqual([]);
    expect(result.state_changed).toBe(false);
    expect(result.narration).toContain("报表使用频率低");
  });

  it("prompts the learner only when the input is unrelated to the world", async () => {
    const world = makeWorldVersion();

    const result = await narrateWorldResponse({
      worldVersion: world,
      userAction: "今天天气怎么样",
      eventHistory: [],
      revealedFactIds: [],
    });

    expect(result.response_type).toBe("clarification");
    expect(result.narration).toContain("没有直接关系");
    expect(result.narration).not.toContain("当前没有可依据的新增信息");
  });

  it("treats a scope question as relevant without requiring a reveal phrase", async () => {
    const result = await narrateWorldResponse({
      worldVersion: DEMO_WORLDS[0].version,
      userAction: "我想了解这个摘要要展示多少信息，我才能知道要做到什么程度",
      eventHistory: [],
      revealedFactIds: ["HF-1-01"],
    });

    expect(result.response_type).toBe("role_reply");
    expect(result.narration).toContain("还不能确定具体范围");
    expect(result.narration).not.toContain("你可以继续调查");
    expect(result.narration).not.toContain("没有直接关系");
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

  it("only emits observations for real, structured discovery evidence", async () => {
    const events = [
      makeEvent("real-evt-001", "workflow"),
      makeEvent("real-evt-002", "consequence"),
    ];
    const decision = makeDecision({ evidence_basis: events.map((event) => event.id) });
    const result = await observeBehavior({
      worldVersion: makeWorldVersion(),
      decisionEvent: decision,
      eventHistory: events,
      wasAssisted: false,
    });

    expect(result.confidence).toBe("medium");
    expect(result.observations).toHaveLength(2);
    expect(result.observations.flatMap((observation) => observation.evidence_event_ids)).toEqual(events.map((event) => event.id));
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
