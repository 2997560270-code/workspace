import { describe, expect, it } from "vitest";
import { createTrainingHistoryRecord } from "../../src/features/history/training-history";
import { generateEvaluation } from "../../src/features/training/evaluation";
import { createTrainingSession, sendTrainingMessage } from "../../src/features/training/training-session";

describe("training history migration", () => {
  it("keeps scenario, mode, messages and score for review", () => {
    const session = sendTrainingMessage(
      createTrainingSession({ scenario: "AI+", mode: "客户咨询", difficulty: "严格" }),
      "我的业务是 AI 知识库"
    );
    const evaluation = generateEvaluation(session);
    const record = createTrainingHistoryRecord(session, evaluation);

    expect(record.title).toBe("AI+ / 客户咨询");
    expect(record.scenario).toBe("AI+");
    expect(record.mode).toBe("客户咨询");
    expect(record.messages.some((message) => message.role === "user")).toBe(true);
    expect(record.totalScore).toBe(evaluation.totalScore);
  });
  it("creates a unique record id for every submitted training attempt", () => {
    const session = sendTrainingMessage(
      createTrainingSession({ scenario: "AI+", mode: "客户咨询", difficulty: "标准" }),
      "我的业务是企业 AI 培训服务"
    );
    const evaluation = generateEvaluation(session);

    const firstRecord = createTrainingHistoryRecord(session, evaluation);
    const secondRecord = createTrainingHistoryRecord(session, evaluation);

    expect(firstRecord.id).not.toBe(secondRecord.id);
  });
});

