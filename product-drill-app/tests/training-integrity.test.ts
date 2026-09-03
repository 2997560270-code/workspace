import { describe, expect, it } from "vitest";
import { generateEvaluation } from "../src/lib/evaluation";
import { addRetryToHistory, createTrainingHistoryRecord, hasServerIntegrity } from "../src/lib/training-history";
import { signTrainingRecord, verifyTrainingRecord } from "../src/lib/training-integrity";
import { createTrainingSession, moveToJudgment, submitJudgment } from "../src/lib/training-session";

function makeRecord() {
  const session = moveToJudgment(createTrainingSession({ scenarioId: "dashboard-request", mode: "练习" }));
  const judged = submitJudgment(session, {
    targetUser: "区域运营",
    currentWorkflow: "每周汇总报表",
    coreProblem: "数据不一致",
    problemImpact: "耗时较长",
    alternative: "Excel",
    recommendation: "先验证数据源",
    successMetric: "准备时间减少",
    biggestAssumption: "数据一致性是主要问题"
  });
  return createTrainingHistoryRecord(judged, generateEvaluation(judged));
}

describe("training record integrity (FB-014)", () => {
  it("verifies a record signed by the server", () => {
    const record = signTrainingRecord(makeRecord());

    expect(hasServerIntegrity(record)).toBe(true);
    expect(verifyTrainingRecord(record)).toBe(true);
  });

  it("rejects unsigned records", () => {
    const record = makeRecord();

    expect(hasServerIntegrity(record)).toBe(false);
    expect(verifyTrainingRecord(record)).toBe(false);
  });

  it("detects a tampered total score", () => {
    const record = signTrainingRecord(makeRecord());

    expect(verifyTrainingRecord({ ...record, totalScore: 100 })).toBe(false);
  });

  it("detects tampered evaluation dimensions", () => {
    const record = signTrainingRecord(makeRecord());
    const tampered = {
      ...record,
      evaluation: {
        ...record.evaluation,
        dimensions: record.evaluation.dimensions.map((dimension) => ({ ...dimension, score: 4 }))
      }
    };

    expect(verifyTrainingRecord(tampered)).toBe(false);
  });

  it("detects tampered conversation content", () => {
    const record = signTrainingRecord(makeRecord());
    const tampered = {
      ...record,
      messages: record.messages.map((message, index) => (index === 0 ? { ...message, content: "被改写的对话" } : message))
    };

    expect(verifyTrainingRecord(tampered)).toBe(false);
  });

  it("detects a retry appended after signing until the server re-signs", () => {
    const record = signTrainingRecord(makeRecord());
    const issue = record.evaluation.issues[0];
    const retried = addRetryToHistory(record, {
      issueId: issue.id,
      targetSkill: issue.targetSkill,
      answer: "你们现在的流程是怎么完成的？",
      improved: true,
      feedback: "已改善"
    });

    expect(verifyTrainingRecord(retried)).toBe(false);
    expect(verifyTrainingRecord(signTrainingRecord(retried))).toBe(true);
  });

  it("ignores display-only mentor notes when verifying", () => {
    const record = signTrainingRecord(makeRecord());
    const noted = { ...record, mentorNote: { author: "导师", content: "继续保持", createdAt: "2026-09-02T12:00:00.000Z" } };

    expect(verifyTrainingRecord(noted)).toBe(true);
  });

  it("rejects forged signatures", () => {
    const record = signTrainingRecord(makeRecord());
    const forged = { ...record, integrity: { ...record.integrity!, signature: "0".repeat(64) } };

    expect(verifyTrainingRecord(forged)).toBe(false);
  });
});
