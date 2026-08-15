import { describe, expect, it } from "vitest";
import { aggregateCommunityReviews, assignRandomReview, createAnonymizedSubjectId, createReviewPoolEntry } from "../src/lib/community-review";

describe("community blind review", () => {
  it("creates an anonymized subject without exposing a user id", () => {
    const entry = createReviewPoolEntry({ id: "pool-1", cohortId: "cohort-1", subjectUserId: "user-1", decisionEventId: "event-1" });
    expect(entry.anonymizedSubjectId).toMatch(/^subject-[A-Z0-9]{10}$/);
    expect(entry.anonymizedSubjectId).not.toContain("user-1");
    expect(createAnonymizedSubjectId("11111111-1111-4111-8111-111111111111")).toBe("subject-1111111111");
  });

  it("randomly assigns an eligible pool entry while excluding self and conflicts", () => {
    const pool = [
      createReviewPoolEntry({ id: "pool-1", cohortId: "cohort-1", subjectUserId: "reviewer-1", decisionEventId: "event-1", conflictGroup: "same-company" }),
      createReviewPoolEntry({ id: "pool-2", cohortId: "cohort-1", subjectUserId: "subject-2", anchorCaseId: "anchor-1" }),
    ];
    const assignment = assignRandomReview({ reviewerId: "reviewer-1", pool, conflictGroups: ["same-company"], random: () => 0 });
    expect(assignment?.poolEntryId).toBe("pool-2");
    expect(assignment?.anonymizedSubjectId).toBe(pool[1].anonymizedSubjectId);
  });

  it("preserves raw ids and exposes disagreement instead of hiding it", () => {
    const aggregate = aggregateCommunityReviews([
      { id: "review-1", assignmentId: "a-1", rubric: { evidence: "meets", confidence: "high" }, evidenceIds: ["e-1"], reason: "引用了决策事件中的具体证据，并说明了不确定性。", confidence: "high" },
      { id: "review-2", assignmentId: "a-2", rubric: { evidence: "misses", confidence: "low" }, evidenceIds: [], reason: "没有看到足够的可追溯证据，因此需要重新复核。", confidence: "low" },
    ]);
    expect(aggregate.rawReviewIds).toEqual(["review-1", "review-2"]);
    expect(aggregate.disagreement.fields).toContain("evidence");
    expect(aggregate.status).toBe("needs_re_review");
  });
});
