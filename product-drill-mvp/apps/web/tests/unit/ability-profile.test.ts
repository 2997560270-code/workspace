import { describe, expect, it } from "vitest";
import { buildAbilityProfile } from "../../src/features/ability-profile/ability-profile";
import type { TrainingHistoryRecord } from "../../src/features/history/training-history";

function record(totalScore: number): TrainingHistoryRecord {
  return {
    id: `history-${totalScore}`,
    title: "AI+ / 客户咨询",
    scenario: "AI+",
    mode: "客户咨询",
    totalScore,
    messages: [],
    evaluation: {
      totalScore,
      dimensions: [
        { name: "需求理解", score: totalScore },
        { name: "问题澄清", score: totalScore - 0.2 },
        { name: "方案设计", score: totalScore - 0.1 }
      ],
      issues: ["价值论证不足", "指标定义不清"]
    }
  };
}

describe("ability profile migration", () => {
  it("aggregates history records into profile metrics", () => {
    const profile = buildAbilityProfile([record(3.8), record(3.2)]);

    expect(profile.completedCount).toBe(2);
    expect(profile.averageScore).toBeGreaterThan(0);
    expect(profile.bestScore).toBeGreaterThanOrEqual(profile.averageScore);
    expect(profile.shortcomings).toContain("价值论证不足");
    expect(profile.nextTraining).toContain("下一轮");
  });
});
