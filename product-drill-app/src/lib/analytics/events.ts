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
  nextTrainingStarted: "next_training_started"
} as const;

export type AnalyticsEvent = typeof ANALYTICS_EVENTS[keyof typeof ANALYTICS_EVENTS];
export type SafeAnalyticsProperties = {
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
  "source"
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
