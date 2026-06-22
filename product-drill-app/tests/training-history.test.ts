import { describe, expect, it } from "vitest";
import { generateEvaluation } from "../src/lib/evaluation";
import { createTrainingHistoryRecord } from "../src/lib/training-history";
import { createTrainingSession, sendTrainingMessage } from "../src/lib/training-session";

describe("training history", () => {
  it("keeps scenario, mode, messages and score for review", () => {
    const session = sendTrainingMessage(
      createTrainingSession({ scenario: "AI+", mode: "客户咨询" }),
      "先确认使用者、场景和指标。"
    );
    const evaluation = generateEvaluation(session);

    const record = createTrainingHistoryRecord(session, evaluation);

    expect(record.scenario).toBe("AI+");
    expect(record.mode).toBe("客户咨询");
    expect(record.totalScore).toBe(evaluation.totalScore);
    expect(record.messages).toHaveLength(3);
  });
});
