import { describe, expect, it } from "vitest";
import { generateEvaluation, SCORE_DIMENSIONS } from "../../src/features/training/evaluation";
import { createTrainingSession, sendTrainingMessage } from "../../src/features/training/training-session";

describe("evaluation migration", () => {
  it("returns a total score, dimensions and concrete issues", () => {
    const session = sendTrainingMessage(
      createTrainingSession({ scenario: "企业培训", mode: "客户咨询", difficulty: "标准" }),
      "我的业务是员工学习路径系统"
    );
    const evaluation = generateEvaluation(session);

    expect(evaluation.totalScore).toBeGreaterThan(0);
    expect(evaluation.dimensions.map((item) => item.name)).toEqual(SCORE_DIMENSIONS);
    expect(evaluation.issues.length).toBeGreaterThanOrEqual(3);
  });
});
