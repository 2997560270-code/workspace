import { describe, expect, it } from "vitest";
import {
  createTrainingSession,
  getCoveragePercent,
  moveToJudgment,
  sendTrainingMessage,
  submitJudgment,
  useTrainingHint
} from "../src/lib/training-session";

describe("direction A training session", () => {
  it("starts with the selected scenario role opening", () => {
    const session = createTrainingSession({ scenarioId: "dashboard-request", mode: "练习" });
    expect(session.scenarioId).toBe("dashboard-request");
    expect(session.messages).toHaveLength(1);
    expect(session.messages[0].content).toContain("数据大屏");
    expect(session.stage).toBe("interview");
  });

  it("reveals a scenario fact and records the covered skill", () => {
    const session = createTrainingSession({ scenarioId: "dashboard-request", mode: "独立" });
    const updated = sendTrainingMessage(session, "你们目前的完整流程是怎么完成的？");
    expect(updated.messages.map((message) => message.role)).toEqual(["ai", "user", "ai"]);
    expect(updated.coveredSkills).toContain("workflow");
    expect(updated.messages.at(-1)?.content).toContain("三个系统导出 Excel");
    expect(getCoveragePercent(updated)).toBe(20);
  });

  it("records hint use in practice mode", () => {
    const session = createTrainingSession({ scenarioId: "dashboard-request", mode: "练习" });
    const updated = useTrainingHint(session);
    expect(updated.hintsUsed).toBe(1);
    expect(updated.messages).toHaveLength(2);
    expect(updated.messages.at(-1)?.content).toContain("轻提示");
  });

  it("moves from interview to a structured product judgment", () => {
    const session = moveToJudgment(createTrainingSession({ scenarioId: "dashboard-request" }));
    const submitted = submitJudgment(session, {
      targetUser: "区域运营",
      currentWorkflow: "从三个系统导出数据并合并",
      coreProblem: "数据编码不一致导致人工核对",
      problemImpact: "每周消耗六小时",
      alternative: "Excel 和免费 BI",
      recommendation: "先统一数据编码，再优化汇总",
      successMetric: "周报准备降低到一小时",
      biggestAssumption: "编码统一可以显著减少核对"
    });
    expect(submitted.stage).toBe("feedback");
    expect(submitted.judgment?.coreProblem).toContain("数据编码");
  });
});
