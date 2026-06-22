import { describe, expect, it } from "vitest";
import { generateEvaluation, SCORE_DIMENSIONS } from "../src/lib/evaluation";
import { createTrainingSession, sendTrainingMessage } from "../src/lib/training-session";

describe("evaluation", () => {
  it("returns a total score, seven dimensions, and concrete issues", () => {
    const session = sendTrainingMessage(
      createTrainingSession({ scenario: "AI+", mode: "用户需求提出" }),
      "我会先确认目标用户和业务指标。"
    );
    const evaluation = generateEvaluation(session);

    expect(evaluation.totalScore).toBeGreaterThan(0);
    expect(evaluation.dimensions.map((dimension) => dimension.name)).toEqual(SCORE_DIMENSIONS);
    expect(evaluation.dimensions).toHaveLength(7);
    expect(evaluation.issues).toHaveLength(3);
    expect(evaluation.issues[0]).toContain("目标用户");
  });
});
