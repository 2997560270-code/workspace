import type { DecisionEvent, Intervention, InterventionType } from "./causal-world";

// ── 干预上下文 ────────────────────────────────────────────────────
export type InterventionContext = {
  decision: DecisionEvent;
  /** 未覆盖的判断维度 */
  missing_dimensions: Array<"workflow" | "consequence" | "alternative">;
  /** 当前世界的触发情境描述 */
  world_trigger: string;
  intervention_type: InterventionType;
};

// ── 干预时序分类结果 ──────────────────────────────────────────────
export type InterventionTimingResult = {
  /** 决策前是否有 hint 干预存在于同一 run */
  was_assisted: boolean;
  /** 在本次决策前触发的 hint id 列表 */
  pre_decision_hint_ids: string[];
};

// ── 维度中文映射 ──────────────────────────────────────────────────
const DIMENSION_LABELS: Record<string, string> = {
  workflow: "当前工作流程（谁在做、怎么做、多高频）",
  consequence: "问题影响与代价（不解决会怎样）",
  alternative: "已有替代方案（尝试过什么）",
};

// ── isPreDecisionHint ─────────────────────────────────────────────
/**
 * 判断一个干预是否是在决策创建之前触发的提示（hint）。
 * 若是，则该决策事件需标记为辅助证据（assisted）。
 */
export function isPreDecisionHint(
  intervention: Intervention,
  decision: DecisionEvent
): boolean {
  if (intervention.intervention_type !== "hint") return false;
  const hintTime = new Date(intervention.triggered_at).getTime();
  const decisionTime = new Date(decision.created_at).getTime();
  return hintTime < decisionTime;
}

// ── classifyInterventionTiming ────────────────────────────────────
/**
 * 检查 run 内所有干预记录，判断给定决策是否被提示辅助过。
 * 只检查与 decision.run_id 相同的干预。
 */
export function classifyInterventionTiming(
  interventionsInRun: Intervention[],
  decision: DecisionEvent
): InterventionTimingResult {
  const sameRunHints = interventionsInRun.filter(
    (i) => i.run_id === decision.run_id && isPreDecisionHint(i, decision)
  );

  return {
    was_assisted: sameRunHints.length > 0,
    pre_decision_hint_ids: sameRunHints.map((i) => i.id),
  };
}

// ── buildInterventionContent ──────────────────────────────────────
/**
 * 根据干预类型和上下文生成干预内容字符串（纯函数，不调用 AI）。
 *
 * 设计约束（来自 Issue #12 验收标准）：
 * - 决策前提示（hint）由调用方在决策 API 前生成，本函数不生成 hint。
 * - 决策后 feedback：说明遗漏维度，不给分数、不打标签。
 * - 决策后 counterfactual：展示"如果探索了这些维度"的路径，不评判能力。
 * - reveal_consequence：重放后果，让用户看到因果链。
 */
export function buildInterventionContent(ctx: InterventionContext): string {
  const { decision, missing_dimensions, world_trigger, intervention_type } = ctx;

  switch (intervention_type) {
    case "feedback":
      return buildFeedbackContent(decision, missing_dimensions, world_trigger);

    case "counterfactual":
      return buildCounterfactualContent(decision, missing_dimensions, world_trigger);

    case "reveal_consequence":
      return buildRevealConsequenceContent(decision, world_trigger);

    case "hint":
      // hint 在决策前触发，用于提示用户关注未探索的维度
      return buildHintContent(missing_dimensions, world_trigger);
  }
}

// ── 私有构建函数 ──────────────────────────────────────────────────

function buildFeedbackContent(
  decision: DecisionEvent,
  missingDimensions: string[],
  worldTrigger: string
): string {
  if (missingDimensions.length === 0) {
    return (
      `你在"${worldTrigger}"这个情境中涵盖了判断所需的三个维度，` +
      `选择了"${decision.chosen_action}"并说明了预期结果。` +
      `这次决策具备完整的证据基础。`
    );
  }

  const missingLabels = missingDimensions
    .map((d) => DIMENSION_LABELS[d] ?? d)
    .join("；");

  return (
    `在"${worldTrigger}"的情境中，你选择了"${decision.chosen_action}"。\n\n` +
    `在做出这个决策时，以下维度尚未有明确证据：\n` +
    missingDimensions.map((d, i) => `${i + 1}. ${DIMENSION_LABELS[d] ?? d}`).join("\n") +
    `\n\n这些维度（${missingLabels}）` +
    `是区分过早承诺与充分调查的核心。` +
    `下一轮你可以关注这些问题，看看获取这些信息是否会改变你的判断。`
  );
}

function buildCounterfactualContent(
  decision: DecisionEvent,
  missingDimensions: string[],
  worldTrigger: string
): string {
  const exploredPath = missingDimensions
    .map((d) => `· 探索${DIMENSION_LABELS[d] ?? d}`)
    .join("\n");

  return (
    `反事实路径：在"${worldTrigger}"中，如果在做出"${decision.chosen_action}"之前先：\n\n` +
    exploredPath +
    `\n\n你可能获得的信息会是……（以下基于已知世界规则的推演）\n` +
    `这条路径与你实际选择的路径不同，` +
    `不意味着哪种判断更正确，而是帮助你看到信息缺口如何影响决策方向。`
  );
}

function buildRevealConsequenceContent(
  decision: DecisionEvent,
  worldTrigger: string
): string {
  return (
    `后果回放：在"${worldTrigger}"情境中，` +
    `你选择了"${decision.chosen_action}"，预期结果为"${decision.expected_outcome}"。\n\n` +
    `实际世界响应已解锁。请对照你的预期，` +
    `观察哪些因果关系你已预见，哪些超出了你当时的信息边界。`
  );
}

function buildHintContent(
  missingDimensions: string[],
  worldTrigger: string
): string {
  if (missingDimensions.length === 0) {
    return `在"${worldTrigger}"中，你还有什么想在决策前确认的信息吗？`;
  }
  const firstMissing = missingDimensions[0];
  const label = DIMENSION_LABELS[firstMissing] ?? firstMissing;
  return `在"${worldTrigger}"中，你了解${label}的情况吗？`;
}
