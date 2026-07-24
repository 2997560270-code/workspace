/**
 * causal-analytics.ts — Issue #3 最小分析事件
 *
 * 设计约束：
 * - 只记录验证产品闭环所需的行为信号（不发送对话原文、决策正文、API key、隐藏事实）
 * - 迁移率指标标记为实验性（isExperimentalMetric = true）
 * - 不预建社区、排名、付费指标
 * - 所有属性通过 sanitizeCausalProperties 白名单过滤
 *
 * 可计算的三类指标：
 * 1. 首个决策完成率 = decisionCommitted / challengeStarted
 * 2. 三世界完成率  = users who fired challengeStarted for world-1,2,3
 * 3. 七日再挑战率  = challengeStarted again within 7 days (PostHog cohort)
 * 4. 迁移率 [实验] = transferEvidenceRecorded(type=transfer) / transferChallengeStarted
 */
import type { TransferRole } from "./causal-world";

// ── 事件名称常量 ──────────────────────────────────────────────────
export const CAUSAL_EVENTS = {
  challengeStarted:             "challenge_started",
  investigationActionCommitted: "investigation_action_committed",
  decisionCommitted:            "decision_committed",
  consequenceRevealed:          "consequence_revealed",
  interventionReceived:         "intervention_received",
  transferChallengeStarted:     "transfer_challenge_started",
  transferEvidenceRecorded:     "transfer_evidence_recorded",
  judgmentProfileViewed:        "judgment_profile_viewed",
} as const;

export type CausalEvent = typeof CAUSAL_EVENTS[keyof typeof CAUSAL_EVENTS];

// ── 允许的属性键（白名单）────────────────────────────────────────
// 规则：只允许枚举值、计数、布尔标志和版本字符串。
// 禁止：对话原文、决策正文、expected_outcome、隐藏事实、API key 及任何自由文本。
export type CausalAnalyticsProperties = {
  worldId?: string;
  worldVersion?: string;
  transferRole?: TransferRole;
  runId?: string;
  wasAssisted?: boolean;
  evidenceBasisCount?: number;
  confidence?: "high" | "medium" | "low" | "insufficient";
  actionCount?: number;
  /** 判断证据画像中的假设条目数（仅用于 judgment_profile_viewed 事件）*/
  hypothesisCount?: number;
  interventionType?: "hint" | "feedback" | "counterfactual" | "reveal_consequence";
  evidenceType?: "supporting" | "counter" | "assisted" | "transfer";
  /** 标记该事件的指标为产品试验指标，不得用于正式能力结论 */
  isExperimentalMetric?: boolean;
};

const ALLOWED_CAUSAL_KEYS = new Set<keyof CausalAnalyticsProperties>([
  "worldId",
  "worldVersion",
  "transferRole",
  "runId",
  "wasAssisted",
  "evidenceBasisCount",
  "confidence",
  "actionCount",
  "hypothesisCount",
  "interventionType",
  "evidenceType",
  "isExperimentalMetric",
]);

// ── 安全过滤器 ────────────────────────────────────────────────────
/**
 * 严格白名单过滤：只保留 ALLOWED_CAUSAL_KEYS 中定义的基本类型字段。
 * 任何对象、数组或未登记字段均被丢弃。
 */
export function sanitizeCausalProperties(
  input: CausalAnalyticsProperties
): CausalAnalyticsProperties {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (
      ALLOWED_CAUSAL_KEYS.has(key as keyof CausalAnalyticsProperties) &&
      (typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean")
    ) {
      result[key] = value;
    }
  }
  return result as CausalAnalyticsProperties;
}

// ── 属性构建函数（每个事件一个，文档化触发位置和字段）────────────

/**
 * challenge_started / transfer_challenge_started
 * 触发位置：WorldWorkbench — run 创建成功后
 * 可计算：首个决策完成率（分母）、三世界完成率、七日再挑战率
 */
export function buildChallengeStartedProps(params: {
  worldId: string;
  worldVersion: string;
  transferRole: TransferRole;
  runId: string;
}): CausalAnalyticsProperties {
  return sanitizeCausalProperties({
    worldId: params.worldId,
    worldVersion: params.worldVersion,
    transferRole: params.transferRole,
    runId: params.runId,
    // 迁移率是实验指标，只有 transfer_test 世界触发时标记
    isExperimentalMetric: params.transferRole === "transfer_test",
  });
}

/**
 * investigation_action_committed
 * 触发位置：WorldWorkbench — 每次 appendAction 成功后
 * 可计算：平均调查深度（actionCount per run）
 */
export function buildInvestigationActionProps(params: {
  worldId: string;
  worldVersion: string;
  runId: string;
  actionCount: number;
}): CausalAnalyticsProperties {
  return sanitizeCausalProperties({
    worldId: params.worldId,
    worldVersion: params.worldVersion,
    runId: params.runId,
    actionCount: params.actionCount,
    isExperimentalMetric: false,
  });
}

/**
 * decision_committed
 * 触发位置：WorldWorkbench — submitDecision 成功后
 * 可计算：首个决策完成率（分子）、辅助决策率
 * 严格不含：judgment、chosen_action、expected_outcome、任何文本
 */
export function buildDecisionCommittedProps(params: {
  worldId: string;
  worldVersion: string;
  runId: string;
  wasAssisted: boolean;
  evidenceBasisCount: number;
  confidence: CausalAnalyticsProperties["confidence"];
}): CausalAnalyticsProperties {
  return sanitizeCausalProperties({
    worldId: params.worldId,
    worldVersion: params.worldVersion,
    runId: params.runId,
    wasAssisted: params.wasAssisted,
    evidenceBasisCount: params.evidenceBasisCount,
    confidence: params.confidence,
    isExperimentalMetric: false,
  });
}

/**
 * consequence_revealed
 * 触发位置：WorldWorkbench — revealConsequences 成功后
 */
export function buildConsequenceRevealedProps(params: {
  worldId: string;
  worldVersion: string;
  runId: string;
}): CausalAnalyticsProperties {
  return sanitizeCausalProperties({
    worldId: params.worldId,
    worldVersion: params.worldVersion,
    runId: params.runId,
    isExperimentalMetric: false,
  });
}

/**
 * intervention_received
 * 触发位置：WorldWorkbench — recordIntervention 成功后
 * 严格不含：intervention content 文本
 */
export function buildInterventionReceivedProps(params: {
  worldId: string;
  worldVersion: string;
  runId: string;
  interventionType: CausalAnalyticsProperties["interventionType"];
}): CausalAnalyticsProperties {
  return sanitizeCausalProperties({
    worldId: params.worldId,
    worldVersion: params.worldVersion,
    runId: params.runId,
    interventionType: params.interventionType,
    isExperimentalMetric: false,
  });
}

/**
 * transfer_evidence_recorded
 * 触发位置：WorldWorkbench — reflect 阶段完成后，当 world 是 transfer_test
 * 可计算：迁移率（实验指标）
 */
export function buildTransferEvidenceProps(params: {
  worldId: string;
  worldVersion: string;
  runId: string;
  evidenceType: CausalAnalyticsProperties["evidenceType"];
}): CausalAnalyticsProperties {
  return sanitizeCausalProperties({
    worldId: params.worldId,
    worldVersion: params.worldVersion,
    runId: params.runId,
    evidenceType: params.evidenceType,
    // 迁移率明确标记为产品试验指标
    isExperimentalMetric: true,
  });
}

/**
 * judgment_profile_viewed
 * 触发位置：JudgmentProfilePanel — 组件挂载完成时
 */
export function buildProfileViewedProps(params: {
  itemCount: number;
}): CausalAnalyticsProperties {
  return sanitizeCausalProperties({
    // Fix (LOW): use dedicated hypothesisCount instead of reusing actionCount
    // to avoid semantic confusion in PostHog dashboards.
    hypothesisCount: params.itemCount,
    isExperimentalMetric: false,
  });
}
