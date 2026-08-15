import { describe, expect, it } from "vitest";
import { aggregateCommunityReviews } from "../src/lib/community-review";
import { calculateReviewerReputation, calculateTrainingCredit, checkReviewRateLimit, detectAccountLinkage, getSeasonalChallengeStatus, routeForReReview } from "../src/lib/community-governance";

describe("community governance", () => {
  it("only trusts reviewers after enough consistently helpful votes", () => {
    expect(calculateReviewerReputation([{ vote: "helpful", reason: "理由足够具体，可以复核。" }, { vote: "helpful", reason: "引用证据并指出了限制。" }, { vote: "helpful", reason: "结构清晰且保留不确定性。" }], 3).status).toBe("trusted");
    expect(calculateReviewerReputation([{ vote: "harmful", reason: "没有引用证据且结论武断。" }, { vote: "harmful", reason: "没有说明不确定性。" }, { vote: "unclear", reason: "理由不足以让其他人复核。" }], 4).status).toBe("restricted");
  });

  it("routes disagreement to re-review without deleting raw reviews", () => {
    const aggregate = aggregateCommunityReviews([{ id: "r1", assignmentId: "a1", rubric: { evidence: "meets" }, evidenceIds: ["e1"], reason: "引用了决策事件中的具体证据，并说明了不确定性。", confidence: "high" }, { id: "r2", assignmentId: "a2", rubric: { evidence: "misses" }, evidenceIds: [], reason: "没有看到足够的可追溯证据，需要重新复核。", confidence: "low" }]);
    expect(routeForReReview(aggregate).required).toBe(true);
    expect(aggregate.rawReviewIds).toHaveLength(2);
  });

  it("rate limits review bursts and returns a retry window", () => {
    const now = Date.parse("2026-08-15T12:00:00.000Z");
    const timestamps = Array.from({ length: 20 }, (_, index) => new Date(now - index * 1000).toISOString());
    const result = checkReviewRateLimit(timestamps, now);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("flags strong linkage signals without making an automatic account decision", () => {
    const flags = detectAccountLinkage([{ accountA: "a", accountB: "b", signalType: "device_hash", strength: 0.8 }, { accountA: "b", accountB: "a", signalType: "ip_window", strength: 0.8 }]);
    expect(flags[0].signalType).toBe("account_linkage");
    expect(flags[0].severity).toBe("medium");
  });

  it("caps quality-settlement credits and keeps challenge status independent", () => {
    const reputation = { qualityScore: 0.9, reviewCount: 5, qualityVoteCount: 5, status: "trusted" as const };
    expect(calculateTrainingCredit(reputation, 18)).toEqual({ amount: 2, remainingCap: 0 });
    expect(getSeasonalChallengeStatus("2026-08-15T00:00:00Z", "2026-08-16T00:00:00Z", Date.parse("2026-08-15T12:00:00Z"))).toBe("active");
  });
});
