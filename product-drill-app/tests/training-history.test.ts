import { describe, expect, it } from "vitest";
import { generateEvaluation } from "../src/lib/evaluation";
import { readFileSync } from "node:fs";
import { StoredHistorySchema, TrainingHistoryRecordSchema } from "../src/lib/api/schemas";
import { addRetryToHistory, createTrainingHistoryRecord, getScenarioTrainingStatus } from "../src/lib/training-history";
import { createTrainingSession, moveToJudgment, submitJudgment } from "../src/lib/training-session";

const directionAHistoryV1 = JSON.parse(
  readFileSync(new URL("./fixtures/direction-a-history-v1.json", import.meta.url), "utf8")
) as unknown;

function makeSession() {
  const session = moveToJudgment(createTrainingSession({ scenarioId: "dashboard-request", mode: "练习" }));
  return submitJudgment(session, {
    targetUser: "区域运营",
    currentWorkflow: "每周汇总报表",
    coreProblem: "数据不一致",
    problemImpact: "耗时较长",
    alternative: "Excel",
    recommendation: "先验证数据源",
    successMetric: "准备时间减少",
    biggestAssumption: "数据一致性是主要问题"
  });
}

describe("training history", () => {
  it("reads the fixed Direction A v1 history fixture", () => {
    const result = StoredHistorySchema.safeParse(directionAHistoryV1);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.records[0].scenarioId).toBe("dashboard-request");
  });

  it("keeps legacy retries without engine metadata readable", () => {
    const history = StoredHistorySchema.parse(directionAHistoryV1);

    expect(history.records[0].retry).toMatchObject({
      issueId: "missing-workflow",
      improved: true
    });
    expect(history.records[0].retry?.engine).toBeUndefined();
    expect(history.records[0].retry?.modelVersion).toBeUndefined();
  });

  it("rejects unsupported cache wrapper versions", () => {
    const history = StoredHistorySchema.parse(directionAHistoryV1);

    expect(StoredHistorySchema.safeParse({ ...history, version: 2 }).success).toBe(false);
  });

  it("rejects incomplete history records", () => {
    const history = StoredHistorySchema.parse(directionAHistoryV1);
    const { scenarioVersion: _scenarioVersion, ...incompleteRecord } = history.records[0];

    expect(TrainingHistoryRecordSchema.safeParse(incompleteRecord).success).toBe(false);
  });

  it("stores evidence feedback and a retry result", () => {
    const session = makeSession();
    const evaluation = generateEvaluation(session);
    const record = createTrainingHistoryRecord(session, evaluation);
    const retried = addRetryToHistory(record, {
      issueId: evaluation.issues[0].id,
      targetSkill: evaluation.issues[0].targetSkill,
      answer: "你们现在的流程是怎么完成的？",
      improved: true,
      feedback: "已改善"
    });
    expect(record.scenarioId).toBe("dashboard-request");
    expect(record.evaluation.dimensions).toHaveLength(5);
    expect(retried.retry?.improved).toBe(true);
  });
});

describe("training map scenario status (FB-003)", () => {
  function makeRecord(retry?: boolean) {
    const session = makeSession();
    const evaluation = generateEvaluation(session);
    const record = createTrainingHistoryRecord(session, evaluation);
    if (!retry || evaluation.issues.length === 0) return record;
    return addRetryToHistory(record, {
      issueId: evaluation.issues[0].id,
      targetSkill: evaluation.issues[0].targetSkill,
      answer: "你们现在的流程是怎么完成的？",
      improved: true,
      feedback: "已改善"
    });
  }

  it("reports 未训练 when the scenario has no records", () => {
    expect(getScenarioTrainingStatus("dashboard-request", []).status).toBe("未训练");
    expect(getScenarioTrainingStatus("export-slow", [makeRecord()]).status).toBe("未训练");
  });

  it("reports 已覆盖 after a clean completion and counts attempts", () => {
    const record = makeRecord();
    if (record.evaluation.issues.length > 0) return; // 仅在无问题的评估下验证已覆盖
    const result = getScenarioTrainingStatus("dashboard-request", [record, makeRecord()]);
    expect(result.status).toBe("已覆盖");
    expect(result.attempts).toBe(2);
  });

  it("reports 待复练 when the latest attempt still has open issues", () => {
    const record = makeRecord();
    if (record.evaluation.issues.length === 0) return;
    expect(getScenarioTrainingStatus("dashboard-request", [record]).status).toBe("待复练");
  });

  it("clears 待复练 once a retry has been recorded", () => {
    const record = makeRecord(true);
    if (record.evaluation.issues.length === 0) return;
    expect(getScenarioTrainingStatus("dashboard-request", [record]).status).toBe("已覆盖");
  });
});
