export type VerifiedOrganization = { id: string; name: string; status: "pending" | "approved" | "suspended" | "closed" };
export type VerifiedSession = { id: string; organizationId: string; assessmentRunId: string; participantId: string; identityStatus: "pending_manual" | "verified" | "failed" | "waived"; environmentStatus: "pending" | "recorded" | "exception"; processStatus: "in_progress" | "completed" | "exception"; humanReviewStatus: "not_started" | "queued" | "reviewing" | "cleared" | "flagged"; consentVersion: string; events: VerifiedProcessEvent[] };
export type VerifiedProcessEvent = { type: "identity_check" | "environment_recorded" | "item_started" | "item_submitted" | "pause" | "resume" | "exception" | "human_review"; payload: Record<string, unknown>; occurredAt: string };
export type VerifiedReport = { sessionId: string; judgmentLevel: "insufficient_evidence" | "emerging" | "consistent" | "strong"; confidenceInterval: { low: number; high: number }; limitations: string[]; usageStatus: "pilot_only" | "internal_review" | "approved_limited" | "withdrawn" };

export function startVerifiedSession(input: { organization: VerifiedOrganization; assessmentRunId: string; participantId: string; consentVersion: string; runSubmitted: boolean }): VerifiedSession {
  if (input.organization.status !== "approved") throw new Error("Verified sessions require an approved organization");
  if (!input.runSubmitted) throw new Error("Assessment run must be submitted before verification");
  if (!input.consentVersion.trim()) throw new Error("Consent version is required");
  return { id: `verified-${crypto.randomUUID()}`, organizationId: input.organization.id, assessmentRunId: input.assessmentRunId, participantId: input.participantId, identityStatus: "pending_manual", environmentStatus: "pending", processStatus: "in_progress", humanReviewStatus: "not_started", consentVersion: input.consentVersion, events: [] };
}

export function recordManualIdentity(session: VerifiedSession, status: "verified" | "failed" | "waived", reviewerId: string): VerifiedSession {
  if (session.processStatus !== "in_progress") throw new Error("Verified session is not active");
  return { ...session, identityStatus: status, events: [...session.events, { type: "identity_check", payload: { status, reviewerId, method: "human" }, occurredAt: new Date().toISOString() }] };
}

export function recordEnvironment(session: VerifiedSession, environment: { browser: string; operatingSystem: string; timezone: string; policyVersion: string }): VerifiedSession {
  if (session.identityStatus === "failed") throw new Error("Failed identity cannot record environment");
  if ([environment.browser, environment.operatingSystem, environment.timezone, environment.policyVersion].some((value) => !value.trim())) throw new Error("Environment record is incomplete");
  return { ...session, environmentStatus: "recorded", events: [...session.events, { type: "environment_recorded", payload: { ...environment, collection: "declared_metadata_only", biometric: false }, occurredAt: new Date().toISOString() }] };
}

export function appendVerifiedProcessEvent(session: VerifiedSession, event: Omit<VerifiedProcessEvent, "occurredAt">): VerifiedSession {
  if (session.processStatus !== "in_progress") throw new Error("Verified session is not active");
  return { ...session, events: [...session.events, { ...event, occurredAt: new Date().toISOString() }] };
}

export function completeVerifiedSession(session: VerifiedSession): VerifiedSession {
  if (!["verified", "waived"].includes(session.identityStatus)) throw new Error("Manual identity review is required");
  if (session.environmentStatus !== "recorded") throw new Error("Environment record is required");
  return { ...session, processStatus: "completed", humanReviewStatus: "queued" };
}

export function clearHumanReview(session: VerifiedSession, reviewerId: string, decision: "cleared" | "flagged"): VerifiedSession {
  if (session.processStatus !== "completed") throw new Error("Session must be completed before human review");
  return { ...session, humanReviewStatus: decision, events: [...session.events, { type: "human_review", payload: { decision, reviewerId }, occurredAt: new Date().toISOString() }] };
}

export function buildVerifiedReport(session: VerifiedSession, score: number): VerifiedReport {
  if (session.humanReviewStatus !== "cleared") throw new Error("Human review must clear the session");
  const bounded = Math.max(0, Math.min(1, score));
  const level = bounded >= 0.8 ? "strong" : bounded >= 0.6 ? "consistent" : bounded >= 0.4 ? "emerging" : "insufficient_evidence";
  const margin = 0.15;
  return { sessionId: session.id, judgmentLevel: level, confidenceInterval: { low: Math.max(0, bounded - margin), high: Math.min(1, bounded + margin) }, limitations: ["这是合作机构试点结果，不是通用招聘结论。", "量尺分、百分位和招聘使用需要更多独立效度证据。", "身份、环境和过程记录不等于自动监考或生物识别。"], usageStatus: "pilot_only" };
}
