/**
 * workbench-state.ts — 世界工作台的纯函数状态机
 *
 * 阶段流转：investigate → commit → reveal → reflect
 *
 * - investigate：用户调查世界、发问、获取信息
 * - commit：用户填写决策表单（判断/行动/预期/置信度），后果未揭示
 * - reveal：后果已揭示，用户看到因果链
 * - reflect：反事实/反馈干预展示，本轮结束
 *
 * 所有函数均为纯函数，不产生副作用（immutability）。
 */

// ── 阶段类型 ──────────────────────────────────────────────────────
export type WorkbenchPhase = "investigate" | "commit" | "reveal" | "reflect";

// ── 决策草稿（表单状态）──────────────────────────────────────────
export type DecisionDraft = {
  judgment: string;
  chosen_action: string;
  expected_outcome: string;
  confidence: "high" | "medium" | "low";
  rejected_alternatives: string[];
  evidence_basis: string[];    // 本次决策引用的 world_event id 列表
};

// ── 工作台完整状态 ────────────────────────────────────────────────
export type WorkbenchState = {
  world_id: string;
  world_version: string;
  phase: WorkbenchPhase;
  /** 当前 run id（由 API 创建后填入） */
  run_id: string | null;
  /** 已提交的 decision event id */
  decision_event_id: string | null;
  /** 是否在本次决策前使用过 hint（影响证据独立性标记） */
  was_assisted: boolean;
  /** 本次 run 内所有 hint 干预的 id 列表 */
  hint_ids: string[];
};

// ── 决策提交载荷（发送给 API 的结构）────────────────────────────
export type DecisionPayload = DecisionDraft & {
  consequences_revealed: false;  // 强制，提交时后果必须未揭示
};

// ── 工厂函数 ──────────────────────────────────────────────────────
export function createWorkbenchState(
  worldId: string,
  worldVersion: string
): WorkbenchState {
  return {
    world_id: worldId,
    world_version: worldVersion,
    phase: "investigate",
    run_id: null,
    decision_event_id: null,
    was_assisted: false,
    hint_ids: [],
  };
}

// ── 状态转换函数（纯函数）────────────────────────────────────────

/**
 * 记录 hint 使用：标记为辅助证据路径，追加 hint id。
 */
export function recordHintUsed(
  state: WorkbenchState,
  hintInterventionId: string
): WorkbenchState {
  return {
    ...state,
    was_assisted: true,
    hint_ids: [...state.hint_ids, hintInterventionId],
  };
}

/**
 * 进入决策提交阶段（investigate → commit）。
 * 只能在 investigate 阶段调用。
 */
export function commitToDecisionPhase(state: WorkbenchState): WorkbenchState {
  if (state.phase !== "investigate") {
    throw new Error(
      `commitToDecisionPhase: 当前阶段为 "${state.phase}"，只能在 investigate 阶段转换`
    );
  }
  return { ...state, phase: "commit" };
}

/**
 * 记录 decision event id，决策已提交到 API。
 */
export function recordDecisionSubmitted(
  state: WorkbenchState,
  decisionEventId: string
): WorkbenchState {
  return { ...state, decision_event_id: decisionEventId };
}

/**
 * 后果已揭示（commit → reveal）。
 */
export function advanceToReveal(state: WorkbenchState): WorkbenchState {
  if (state.phase !== "commit") {
    throw new Error(
      `advanceToReveal: 当前阶段为 "${state.phase}"，只能在 commit 阶段转换`
    );
  }
  return { ...state, phase: "reveal" };
}

/**
 * 进入反思阶段（reveal → reflect）。
 */
export function advanceToReflect(state: WorkbenchState): WorkbenchState {
  if (state.phase !== "reveal") {
    throw new Error(
      `advanceToReflect: 当前阶段为 "${state.phase}"，只能在 reveal 阶段转换`
    );
  }
  return { ...state, phase: "reflect" };
}

// ── 守卫函数 ──────────────────────────────────────────────────────

/**
 * 是否满足"揭示后果"的前置条件：
 * - 必须在 commit 阶段（已提交决策，后果尚未揭示）
 * - 必须有 decision_event_id
 */
export function canRevealConsequences(state: WorkbenchState): boolean {
  return state.phase === "commit" && state.decision_event_id !== null;
}

// ── 决策载荷构造 ──────────────────────────────────────────────────

/**
 * 从决策草稿构造 API 提交载荷。
 * 必填字段（judgment / chosen_action / expected_outcome）为空时返回 null，
 * 防止提交不完整的决策。
 */
export function buildDecisionPayload(
  draft: DecisionDraft
): DecisionPayload | null {
  if (
    !draft.judgment.trim() ||
    !draft.chosen_action.trim() ||
    !draft.expected_outcome.trim()
  ) {
    return null;
  }
  return {
    ...draft,
    consequences_revealed: false,
  };
}
