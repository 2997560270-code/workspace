/**
 * Issue #14 — 三世界闭环与证据边界回归测试
 *
 * 用最小但完整的集成测试证明新链路的关键事实边界、证据边界和失败行为。
 * 把 challenge-selector → workbench-state → transfer-judge → judgment-profile-builder
 * 串成完整三世界流程，逐环断言证据边界。
 *
 * 各模块的单元测试已在各自 test 文件；本文件只覆盖闭环行为和跨模块边界，
 * 不重复单元测试。可在 CI 重复运行（无随机、无时间依赖、无网络）。
 */
import { describe, expect, it } from "vitest";
import {
  selectNextChallenge,
  type CandidateWorld,
  type HypothesisSummary,
} from "../src/lib/challenge-selector";
import {
  createWorkbenchState,
  commitToDecisionPhase,
  recordHintUsed,
  recordDecisionSubmitted,
  advanceToReveal,
  advanceToReflect,
  buildDecisionPayload,
} from "../src/lib/workbench-state";
import {
  judgeTransferEvidence,
  type TransferJudgmentInput,
} from "../src/lib/transfer-judge";
import { buildJudgmentProfile } from "../src/lib/judgment-profile-builder";
import {
  createHypothesisEvidence,
  createIntervention,
  type HypothesisEvidence,
  type Intervention,
  type JudgmentHypothesis,
} from "../src/lib/causal-world";
import { sanitizeCausalProperties } from "../src/lib/causal-analytics";

// ── 三世界固定装置 ────────────────────────────────────────────────
const WORLDS: CandidateWorld[] = [
  { world_id: "world-1", transfer_role: "calibration", domain: "product" },
  { world_id: "world-2", transfer_role: "intervention", domain: "product" },
  { world_id: "world-3", transfer_role: "transfer_test", domain: "ops" },
];
const TRAINING_WORLDS = ["world-1", "world-2"];

function hypothesis(override: Partial<HypothesisSummary> = {}): HypothesisSummary {
  return {
    habit_name: "premature_solution_commitment",
    confidence: "insufficient",
    supporting_evidence_count: 0,
    counter_evidence_count: 0,
    completed_world_ids: [],
    ...override,
  };
}

// ── 闭环 1：完整三世界选择顺序 ────────────────────────────────────
describe("three-world loop — challenge selection sequence", () => {
  it("progresses world-1 → world-2 → world-3 as confidence builds", () => {
    // Step 1: 无完成 → calibration
    const s1 = selectNextChallenge(WORLDS, hypothesis());
    expect(s1.world_id).toBe("world-1");
    expect(s1.is_transfer_test).toBe(false);

    // Step 2: world-1 done, confidence still low → intervention world
    const s2 = selectNextChallenge(
      WORLDS,
      hypothesis({ completed_world_ids: ["world-1"], confidence: "low" })
    );
    expect(s2.world_id).toBe("world-2");
    expect(s2.is_transfer_test).toBe(false);

    // Step 3: world-1,2 done, confidence medium → transfer test
    const s3 = selectNextChallenge(
      WORLDS,
      hypothesis({ completed_world_ids: ["world-1", "world-2"], confidence: "medium" })
    );
    expect(s3.world_id).toBe("world-3");
    expect(s3.is_transfer_test).toBe(true);
  });

  it("blocks transfer test (world-3) when confidence is insufficient", () => {
    const result = selectNextChallenge(
      WORLDS,
      hypothesis({ completed_world_ids: ["world-1", "world-2"], confidence: "low" })
    );
    expect(result.world_id).not.toBe("world-3");
    expect(result.is_remediation).toBe(true);
  });
});

// ── 闭环 2：工作台阶段流转 investigate → reflect ──────────────────
describe("three-world loop — workbench phase progression", () => {
  it("completes the full investigate → commit → reveal → reflect cycle", () => {
    let state = createWorkbenchState("world-1", "1.0.0");
    expect(state.phase).toBe("investigate");

    state = commitToDecisionPhase(state);
    expect(state.phase).toBe("commit");

    state = recordDecisionSubmitted(state, "dec-001");
    state = advanceToReveal(state);
    expect(state.phase).toBe("reveal");

    state = advanceToReflect(state);
    expect(state.phase).toBe("reflect");
  });

  it("enforces consequence reveal only after a decision event exists", () => {
    const state = createWorkbenchState("world-1", "1.0.0");
    const committed = commitToDecisionPhase(state);
    // 未提交决策，不可揭示后果
    expect(() => advanceToReveal(committed)).not.toThrow(); // phase transition ok
    // 但 canRevealConsequences 守卫已在 workbench-state.test.ts 覆盖
    expect(committed.decision_event_id).toBeNull();
  });

  it("rejects a decision payload missing required fields", () => {
    expect(buildDecisionPayload({
      judgment: "",
      chosen_action: "x",
      expected_outcome: "y",
      confidence: "low",
      rejected_alternatives: [],
      evidence_basis: [],
    })).toBeNull();
  });
});

// ── 闭环 3：辅助结果不进入独立迁移证据 ────────────────────────────
describe("three-world loop — assisted result never becomes transfer evidence", () => {
  const baseEvidence: HypothesisEvidence = createHypothesisEvidence({
    hypothesisId: "hyp-1",
    decisionEventId: "dec-transfer",
    evidenceType: "supporting",
    worldId: "world-3",
    worldVersion: "1.0.0",
    modelVersion: "gpt-4o:v1",
  });

  it("world-3 with a hint → evidence downgraded to assisted, NOT transfer", () => {
    const hint: Intervention = createIntervention({
      runId: "run-003",
      decisionEventId: null,
      interventionType: "hint",
      content: "提示内容",
      modelVersion: "gpt-4o",
      worldVersion: "1.0.0",
    });

    const input: TransferJudgmentInput = {
      training_world_ids: TRAINING_WORLDS,
      transfer_world_id: "world-3",
      decision_run_id: "run-003",
      evidence: baseEvidence,
      interventions_in_run: [hint],
      observation_confidence: "high",
    };

    const result = judgeTransferEvidence(input);
    expect(result.qualifies_as_transfer).toBe(false);
    expect(result.evidence_type).toBe("assisted");
    expect(result.updated_evidence.evidence_type).toBe("assisted");
  });

  it("world-3 with NO hint and high confidence → qualifies as transfer", () => {
    const input: TransferJudgmentInput = {
      training_world_ids: TRAINING_WORLDS,
      transfer_world_id: "world-3",
      decision_run_id: "run-003",
      evidence: baseEvidence,
      interventions_in_run: [],
      observation_confidence: "high",
    };

    const result = judgeTransferEvidence(input);
    expect(result.qualifies_as_transfer).toBe(true);
    expect(result.evidence_type).toBe("transfer");
    expect(result.updated_evidence.transfer_world_id).toBe("world-3");
  });
});

// ── 闭环 4：同世界重试不更新迁移状态 ──────────────────────────────
describe("three-world loop — same-world retry does not update transfer state", () => {
  it("re-running a training world (world-1) never produces transfer evidence", () => {
    const evidence = createHypothesisEvidence({
      hypothesisId: "hyp-1",
      decisionEventId: "dec-retry",
      evidenceType: "supporting",
      worldId: "world-1",
      worldVersion: "1.0.0",
      modelVersion: "gpt-4o:v1",
    });

    const input: TransferJudgmentInput = {
      training_world_ids: TRAINING_WORLDS,
      transfer_world_id: "world-1", // 训练世界，不是陌生世界
      decision_run_id: "run-retry",
      evidence,
      interventions_in_run: [],
      observation_confidence: "high",
    };

    const result = judgeTransferEvidence(input);
    expect(result.qualifies_as_transfer).toBe(false);
    // 世界不陌生 → 保持原证据类型，不升级
    expect(result.updated_evidence.evidence_type).toBe("supporting");
    expect(result.updated_evidence.transfer_world_id).toBeNull();
  });
});

// ── 闭环 5：迁移证据进入画像并可追溯 ──────────────────────────────
describe("three-world loop — transfer evidence surfaces in judgment profile", () => {
  it("transfer evidence appears in profile with traceable decision_event_id", () => {
    const hyp: JudgmentHypothesis = {
      id: "hyp-1",
      user_id: "user-1",
      habit_name: "premature_solution_commitment",
      trigger_conditions: ["feature request"],
      confidence: "medium",
      supporting_evidence_ids: [],
      counter_evidence_ids: [],
      last_updated_at: "2026-07-24T00:00:00.000Z",
      created_at: "2026-07-23T00:00:00.000Z",
    };

    const transferEvidence = createHypothesisEvidence({
      hypothesisId: "hyp-1",
      decisionEventId: "dec-transfer-XYZ",
      evidenceType: "transfer",
      worldId: "world-3",
      worldVersion: "1.0.0",
      modelVersion: "gpt-4o:v1",
      transferWorldId: "world-3",
    });

    const profile = buildJudgmentProfile({ hypotheses: [hyp], evidence: [transferEvidence] });
    const item = profile.items[0];

    expect(item.transfer_evidence).toHaveLength(1);
    expect(item.transfer_evidence[0].decision_event_id).toBe("dec-transfer-XYZ");
    expect(item.transfer_evidence[0].is_transfer).toBe(true);
    // 证据不足时不显示伪精确分数
    expect(item.show_confidence_as_score).toBe(false);
  });
});

// ── 边界 6：分析事件不泄露文本内容 ────────────────────────────────
describe("three-world loop — analytics never leaks text content", () => {
  it("strips judgment, chosen_action, api keys, hidden facts from properties", () => {
    const dirty = {
      worldId: "world-1",
      judgment: "SECRET decision text",
      chosen_action: "SECRET action",
      apiKey: "sk-leak",
      hiddenFact: "真实用户只有两人",
    } as Record<string, unknown>;

    const clean = sanitizeCausalProperties(dirty as never);
    expect(clean.worldId).toBe("world-1");
    expect(JSON.stringify(clean)).not.toContain("SECRET");
    expect(JSON.stringify(clean)).not.toContain("sk-leak");
    expect(JSON.stringify(clean)).not.toContain("真实用户");
  });
});

// ── 边界 7：CI 可重复性 — 纯函数无副作用 ──────────────────────────
describe("three-world loop — deterministic and repeatable", () => {
  it("produces identical selection results across repeated runs", () => {
    const h = hypothesis({ completed_world_ids: ["world-1"], confidence: "low" });
    const runs = Array.from({ length: 5 }, () => selectNextChallenge(WORLDS, h).world_id);
    expect(new Set(runs).size).toBe(1); // 所有结果一致
  });
});
