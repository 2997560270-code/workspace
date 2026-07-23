import { describe, expect, it } from "vitest";
import { generateEvaluation } from "../src/lib/evaluation";
import { addRetryToHistory, createTrainingHistoryRecord } from "../src/lib/training-history";
import { createTrainingSession, moveToJudgment, submitJudgment } from "../src/lib/training-session";

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
