export const ANALYTICS_EVENTS = {
  onboardingStarted: "onboarding_started",
  onboardingCompleted: "onboarding_completed",
  trainingStarted: "training_started",
  trainingMessageSent: "training_message_sent",
  trainingAbandoned: "training_abandoned",
  judgmentSubmitted: "judgment_submitted",
  evaluationViewed: "evaluation_viewed",
  retryStarted: "retry_started",
  retryCompleted: "retry_completed",
  improvementRecorded: "improvement_recorded",
  nextTrainingStarted: "next_training_started",
  // Issue #3: causal analytics events
  challengeStarted: "challenge_started",
  investigationActionCommitted: "investigation_action_committed",
  decisionCommitted: "decision_committed",
  consequenceRevealed: "consequence_revealed",
  interventionReceived: "intervention_received",
  transferChallengeStarted: "transfer_challenge_started",
  transferEvidenceRecorded: "transfer_evidence_recorded",
  judgmentProfileViewed: "judgment_profile_viewed",
} as const;

export type AnalyticsEvent = typeof ANALYTICS_EVENTS[keyof typeof ANALYTICS_EVENTS];
export type SafeAnalyticsProperties = {
  // 旧训练链路
  scenarioId?: string;
  scenarioVersion?: number;
  rubricVersion?: string;
  modelVersion?: string;
  engine?: string;
  mode?: string;
  targetSkill?: string;
  improved?: boolean;
  scoreBand?: "0-39" | "40-59" | "60-79" | "80-100";
  source?: string;
  // Issue #3: 因果分析链路（不包含文本内容，只记录计数和枚举）
  worldId?: string;
  worldVersion?: string;
  transferRole?: "calibration" | "intervention" | "transfer_test";
  runId?: string;
  wasAssisted?: boolean;
  evidenceBasisCount?: number;
  confidence?: "high" | "medium" | "low" | "insufficient";
  actionCount?: number;
  interventionType?: "hint" | "feedback" | "counterfactual" | "reveal_consequence";
  evidenceType?: "supporting" | "counter" | "assisted" | "transfer";
  isExperimentalMetric?: boolean;
};

const ALLOWED_PROPERTY_KEYS = new Set<keyof SafeAnalyticsProperties>([
  "scenarioId",
  "scenarioVersion",
  "rubricVersion",
  "modelVersion",
  "engine",
  "mode",
  "targetSkill",
  "improved",
  "scoreBand",
  "source",
  // Issue #3
  "worldId",
  "worldVersion",
  "transferRole",
  "runId",
  "wasAssisted",
  "evidenceBasisCount",
  "confidence",
  "actionCount",
  "interventionType",
  "evidenceType",
  "isExperimentalMetric",
]);

export function sanitizeAnalyticsProperties(input: Record<string, unknown> | undefined): SafeAnalyticsProperties {
  if (!input) return {};
  const entries = Object.entries(input).filter(([key, value]) =>
    ALLOWED_PROPERTY_KEYS.has(key as keyof SafeAnalyticsProperties)
    && (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
  );
  return Object.fromEntries(entries) as SafeAnalyticsProperties;
}

export function scoreBand(score: number): SafeAnalyticsProperties["scoreBand"] {
  if (score < 40) return "0-39";
  if (score < 60) return "40-59";
  if (score < 80) return "60-79";
  return "80-100";
}
