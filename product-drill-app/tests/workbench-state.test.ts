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
  canRevealConsequences,
  advanceToReflect,
  type WorkbenchState,
  type DecisionDraft,
} from "../src/lib/workbench-state";

// ── fixtures ──────────────────────────────────────────────────────
function makeDraft(override: Partial<DecisionDraft> = {}): DecisionDraft {
  return {
    judgment: "认为问题是X",
    chosen_action: "建议方案A",
    expected_outcome: "提升效率",
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
    expect(payload?.judgment).toBe("认为问题是X");
    expect(payload?.confidence).toBe("medium");
  });

  it("consequences_revealed is always false in the payload", () => {
    const draft = makeDraft();
    const payload = buildDecisionPayload(draft);
    expect(payload?.consequences_revealed).toBe(false);
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
