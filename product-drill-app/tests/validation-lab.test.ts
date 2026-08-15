import { beforeEach, describe, expect, it, vi } from "vitest";
import { createReview, createValidationCohort, joinValidationCohort, loadValidationState, saveValidationState } from "../src/lib/validation-lab";

describe("validation lab", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal("window", { localStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) } });
  });

  it("creates an invitation-only cohort and joins a participant", () => {
    const cohort = createValidationCohort("封闭试验 01");
    expect(cohort.inviteCode).toMatch(/^[A-Z0-9]{10}$/);
    const joined = joinValidationCohort(cohort, { userId: "u1", name: "测试者", role: "target_user", status: "active" });
    expect(joined.participants).toHaveLength(1);
  });

  it("keeps review reasons and confidence explicit", () => {
    const review = createReview({ cohortId: "c1", reviewerId: "u1", subject: "匿名锚例 A-01", rubric: { evidence: "meets" }, reason: "引用了决策事件中的具体证据，并说明了仍不确定的地方。", confidence: "medium" });
    saveValidationState({ cohorts: [], reviews: [review], metrics: [] });
    expect(loadValidationState().reviews[0]).toEqual(review);
  });
});
