import { describe, expect, it } from "vitest";
import type { TrainingHistoryRecord } from "../src/lib/training-history";
import { buildAbilityProfile } from "../src/lib/ability-profile";

function record(totalScore: number): TrainingHistoryRecord {
  return {
    id: `r-${totalScore}`,
    title: "AI+ / 用户需求提出",
    scenario: "AI+",
    mode: "用户需求提出",
    totalScore,
    messages: [],
    evaluation: {
      totalScore,
      dimensions: [
        { name: "需求理解", score: totalScore },
        { name: "问题澄清", score: totalScore - 0.2 },
        { name: "方案设计", score: totalScore - 0.4 }
      ],
      issues: ["目标用户不够具体", "价值指标不够清晰"]
    }
  };
}

describe("ability profile", () => {
  it("aggregates history records into profile metrics", () => {
    const profile = buildAbilityProfile([record(3.8), record(3.2)]);

    expect(profile.averageScore).toBe(70);
    expect(profile.completedCount).toBe(2);
    expect(profile.bestScore).toBe(76);
    expect(profile.progress).toBe(12);
    expect(profile.trend).toHaveLength(2);
    expect(profile.dimensions[0].name).toBe("需求理解");
    expect(profile.shortcomings.some((item) => item.includes("价值指标"))).toBe(true);
    expect(profile.nextTraining).toContain("下一轮建议训练");
  });
});
