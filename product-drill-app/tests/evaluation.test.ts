import { describe, expect, it } from "vitest";
import { evaluateRetry, generateEvaluation } from "../src/lib/evaluation";
import { createTrainingSession, moveToJudgment, sendTrainingMessage, submitJudgment } from "../src/lib/training-session";

function completedSession() {
  let session = createTrainingSession({ scenarioId: "dashboard-request", mode: "训练" });
  session = sendTrainingMessage(session, "谁每天使用这些报表，谁负责决策？");
  session = sendTrainingMessage(session, "你们目前的流程是怎么完成的？");
  session = moveToJudgment(session);
  return submitJudgment(session, {
    targetUser: "区域运营和门店负责人",
    currentWorkflow: "每周从多个系统导出数据",
    coreProblem: "编码不一致造成核对成本",
    problemImpact: "每周需要六小时整理",
    alternative: "Excel 模板",
    recommendation: "先解决数据一致性，再考虑大屏",
    successMetric: "周报准备缩短到一小时",
    biggestAssumption: "统一编码能覆盖主要人工成本"
  });
}

describe("evidence evaluation", () => {
  it("returns five evidence dimensions and actionable issues", () => {
    const evaluation = generateEvaluation(completedSession());
    expect(evaluation.dimensions).toHaveLength(5);
    expect(evaluation.totalScore).toBeGreaterThan(0);
    expect(evaluation.dimensions.find((item) => item.id === "workflow")?.evidence).toContain("目前的流程");
    expect(evaluation.issues.length).toBeGreaterThan(0);
    expect(evaluation.issues[0].retryPrompt.length).toBeGreaterThan(10);
  });

  it("checks whether a local retry is specific enough", () => {
    expect(evaluateRetry("你们现在的完整流程是怎么完成的？", "workflow").improved).toBe(true);
    expect(evaluateRetry("还有什么？", "workflow").improved).toBe(false);
  });
});
