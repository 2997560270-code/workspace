/**
 * Issue #4 — workbench-state 纯函数测试
 * 覆盖阶段转换、决策表单校验、辅助状态追踪
 */
import { describe, expect, it } from "vitest";
import {
  createWorkbenchState,
  commitToDecisionPhase,
  recordHintUsed,
  buildDecisionPayload,
  getDecisionDraftIssues,
  getDecisionFieldIssue,
  isMeaninglessText,
  canRevealConsequences,
  advanceToReflect,
  type WorkbenchState,
  type DecisionDraft,
} from "../src/lib/workbench-state";

// ── fixtures ──────────────────────────────────────────────────────
function makeDraft(override: Partial<DecisionDraft> = {}): DecisionDraft {
  return {
    judgment: "真正的问题是数据编码不一致",
    chosen_action: "先统一数据编码，再评估大屏必要性",
    expected_outcome: "数据整理时间从每周 6 小时降到 1 小时",
    confidence: "medium",
    rejected_alternatives: ["方案B"],
    evidence_basis: ["evt-001"],
    ...override,
  };
}

// ── createWorkbenchState ──────────────────────────────────────────
describe("createWorkbenchState", () => {
  it("starts in investigate phase", () => {
    const state = createWorkbenchState("world-1", "1.0.0");
    expect(state.phase).toBe("investigate");
  });

  it("starts with was_assisted = false", () => {
    const state = createWorkbenchState("world-1", "1.0.0");
    expect(state.was_assisted).toBe(false);
  });

  it("starts with empty hint_ids", () => {
    const state = createWorkbenchState("world-1", "1.0.0");
    expect(state.hint_ids).toHaveLength(0);
  });
});

// ── recordHintUsed ────────────────────────────────────────────────
describe("recordHintUsed", () => {
  it("sets was_assisted = true and records hint id", () => {
    const state = createWorkbenchState("world-1", "1.0.0");
    const next = recordHintUsed(state, "int-hint-001");
    expect(next.was_assisted).toBe(true);
    expect(next.hint_ids).toContain("int-hint-001");
  });

  it("is immutable — original state unchanged", () => {
    const state = createWorkbenchState("world-1", "1.0.0");
    recordHintUsed(state, "int-hint-001");
    expect(state.was_assisted).toBe(false);
    expect(state.hint_ids).toHaveLength(0);
  });

  it("accumulates multiple hints", () => {
    let state = createWorkbenchState("world-1", "1.0.0");
    state = recordHintUsed(state, "int-001");
    state = recordHintUsed(state, "int-002");
    expect(state.hint_ids).toHaveLength(2);
  });
});

// ── commitToDecisionPhase ─────────────────────────────────────────
describe("commitToDecisionPhase", () => {
  it("transitions from investigate to commit phase", () => {
    const state = createWorkbenchState("world-1", "1.0.0");
    const next = commitToDecisionPhase(state);
    expect(next.phase).toBe("commit");
  });

  it("throws if not in investigate phase", () => {
    const state = createWorkbenchState("world-1", "1.0.0");
    const committed = commitToDecisionPhase(state);
    expect(() => commitToDecisionPhase(committed)).toThrow();
  });
});

// ── buildDecisionPayload ──────────────────────────────────────────
describe("buildDecisionPayload", () => {
  it("returns null when required fields are empty", () => {
    const draft = makeDraft({ judgment: "" });
    expect(buildDecisionPayload(draft)).toBeNull();
  });

  it("returns null when chosen_action is empty", () => {
    const draft = makeDraft({ chosen_action: "" });
    expect(buildDecisionPayload(draft)).toBeNull();
  });

  it("returns null when expected_outcome is empty", () => {
    const draft = makeDraft({ expected_outcome: "" });
    expect(buildDecisionPayload(draft)).toBeNull();
  });

  it("returns the payload when all required fields are present", () => {
    const draft = makeDraft();
    const payload = buildDecisionPayload(draft);
    expect(payload).not.toBeNull();
    expect(payload?.judgment).toBe("真正的问题是数据编码不一致");
    expect(payload?.confidence).toBe("medium");
  });

  it("consequences_revealed is always false in the payload", () => {
    const draft = makeDraft();
    const payload = buildDecisionPayload(draft);
    expect(payload?.consequences_revealed).toBe(false);
  });

  // FB-013：无效输入不能走完决策流程获得正面后果。
  it("returns null for meaningless gibberish like \"hhhh\"", () => {
    expect(buildDecisionPayload(makeDraft({ judgment: "hhhh" }))).toBeNull();
    expect(buildDecisionPayload(makeDraft({ chosen_action: "111111" }))).toBeNull();
    expect(buildDecisionPayload(makeDraft({ expected_outcome: "？？？？" }))).toBeNull();
  });

  it("returns null for content that is too short to be a judgment", () => {
    expect(buildDecisionPayload(makeDraft({ judgment: "先查一下" }))).toBeNull();
  });

  it("still accepts real, readable judgments", () => {
    expect(buildDecisionPayload(makeDraft())).not.toBeNull();
  });
});

// ── decision field validation (FB-013) ─────────────────────────────────────
describe("decision field validation", () => {
  it("detects meaningless text", () => {
    expect(isMeaninglessText("hhhh")).toBe(true);
    expect(isMeaninglessText("aaaaa")).toBe(true);
    expect(isMeaninglessText("？？？？？")).toBe(true);
    expect(isMeaninglessText("ababab")).toBe(true);
    expect(isMeaninglessText("真正的问题是数据不一致")).toBe(false);
    expect(isMeaninglessText("hhhh hhhh")).toBe(true);
  });

  it("explains why a field is invalid", () => {
    expect(getDecisionFieldIssue("")).toContain("必填");
    expect(getDecisionFieldIssue("hhhh")).toContain("有效内容");
    expect(getDecisionFieldIssue("太短了")).toContain("过短");
    expect(getDecisionFieldIssue("真正的问题是数据编码不一致")).toBeNull();
  });

  it("lists per-field issues for the draft", () => {
    const issues = getDecisionDraftIssues(makeDraft({ judgment: "hhhh", expected_outcome: "" }));
    expect(issues.judgment).toContain("有效内容");
    expect(issues.expected_outcome).toContain("必填");
    expect(issues.chosen_action).toBeUndefined();
  });
});

// ── canRevealConsequences ─────────────────────────────────────────
describe("canRevealConsequences", () => {
  it("returns false when no decision_event_id exists", () => {
    const state = createWorkbenchState("world-1", "1.0.0");
    expect(canRevealConsequences(state)).toBe(false);
  });

  it("returns true when decision_event_id is set and phase is commit", () => {
    const state: WorkbenchState = {
      ...createWorkbenchState("world-1", "1.0.0"),
      phase: "commit",
      decision_event_id: "dec-001",
    };
    expect(canRevealConsequences(state)).toBe(true);
  });

  it("returns false in reveal or reflect phase (already revealed)", () => {
    for (const phase of ["reveal", "reflect"] as const) {
      const state: WorkbenchState = {
        ...createWorkbenchState("world-1", "1.0.0"),
        phase,
        decision_event_id: "dec-001",
      };
      expect(canRevealConsequences(state)).toBe(false);
    }
  });
});

// ── advanceToReflect ──────────────────────────────────────────────
describe("advanceToReflect", () => {
  it("transitions from reveal to reflect", () => {
    const state: WorkbenchState = {
      ...createWorkbenchState("world-1", "1.0.0"),
      phase: "reveal",
      decision_event_id: "dec-001",
    };
    const next = advanceToReflect(state);
    expect(next.phase).toBe("reflect");
  });

  it("throws if not in reveal phase", () => {
    const state = createWorkbenchState("world-1", "1.0.0");
    expect(() => advanceToReflect(state)).toThrow();
  });
});
