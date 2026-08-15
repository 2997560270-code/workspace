import type { ReviewAggregate } from "./community-review";

export type QualityVote = { vote: "helpful" | "unclear" | "harmful"; reason: string };
export type ReviewerReputation = { qualityScore: number; reviewCount: number; qualityVoteCount: number; status: "provisional" | "trusted" | "restricted" | "suspended" };
export type RateLimitResult = { allowed: boolean; remaining: number; retryAfterSeconds: number };
export type LinkageSignal = { accountA: string; accountB: string; signalType: "device_hash" | "payment_hash" | "ip_window"; strength: number };
export type AnomalyFlag = { signalType: "rate_limit" | "account_linkage" | "copy_pattern" | "conflict_bypass" | "quality_outlier"; severity: "low" | "medium" | "high"; evidence: Record<string, unknown> };

export function calculateReviewerReputation(votes: QualityVote[], reviewCount: number): ReviewerReputation {
  const points = votes.reduce((sum, vote) => sum + (vote.vote === "helpful" ? 1 : vote.vote === "unclear" ? 0.5 : 0), 0);
  const qualityScore = votes.length ? Math.round((points / votes.length) * 100) / 100 : 0;
  const status = qualityScore >= 0.75 && reviewCount >= 3 ? "trusted" : qualityScore < 0.35 && votes.length >= 3 ? "restricted" : "provisional";
  return { qualityScore, reviewCount, qualityVoteCount: votes.length, status };
}

export function routeForReReview(aggregate: ReviewAggregate): { required: boolean; reason: string } {
  if (aggregate.status === "needs_re_review") return { required: true, reason: aggregate.disagreement.fields.length ? `Rubric 分歧：${aggregate.disagreement.fields.join(", ")}` : "原始评审数量不足，无法判断一致性" };
  return { required: false, reason: "当前分歧未超过复审阈值" };
}

export function checkReviewRateLimit(timestamps: string[], now = Date.now(), maxReviews = 20, windowMs = 60 * 60 * 1000): RateLimitResult {
  const recent = timestamps.filter((value) => now - new Date(value).getTime() < windowMs);
  const remaining = Math.max(0, maxReviews - recent.length);
  return { allowed: recent.length < maxReviews, remaining, retryAfterSeconds: recent.length < maxReviews ? 0 : Math.max(1, Math.ceil((windowMs - (now - Math.min(...recent.map((value) => new Date(value).getTime())))) / 1000)) };
}

export function detectAccountLinkage(signals: LinkageSignal[]): AnomalyFlag[] {
  const grouped = new Map<string, LinkageSignal[]>();
  for (const signal of signals) {
    const key = ["accounts", ...[signal.accountA, signal.accountB].sort()].join(":");
    grouped.set(key, [...(grouped.get(key) ?? []), signal]);
  }
  return [...grouped.values()]
    .filter((items) => items.reduce((sum, item) => sum + item.strength, 0) >= 1.5)
    .map((items) => ({ signalType: "account_linkage" as const, severity: items.some((item) => item.strength >= 0.9) ? "high" as const : "medium" as const, evidence: { accounts: [items[0].accountA, items[0].accountB], signals: items.map((item) => item.signalType) } }));
}

export function calculateTrainingCredit(reputation: ReviewerReputation, alreadyIssued = 0, cap = 20): { amount: number; remainingCap: number } {
  if (reputation.status !== "trusted") return { amount: 0, remainingCap: Math.max(0, cap - alreadyIssued) };
  const remainingCap = Math.max(0, cap - alreadyIssued);
  const amount = Math.min(5, remainingCap);
  return { amount, remainingCap: remainingCap - amount };
}

export function getSeasonalChallengeStatus(startsAt: string, endsAt: string, now = Date.now()): "scheduled" | "active" | "closed" {
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  if (now < start) return "scheduled";
  if (now >= end) return "closed";
  return "active";
}
