import { describe, expect, it } from "vitest";
import { generateEvaluation } from "../src/lib/evaluation";
import { createTrainingHistoryRecord } from "../src/lib/training-history";
import { selectTodayScenario } from "../src/lib/today-recommendation";
import { createTrainingSession, sendTrainingMessage } from "../src/lib/training-session";

function recordFor(scenarioId: string, message: string) {
  const session = sendTrainingMessage(
    createTrainingSession({ scenarioId, mode: "训练" }),
    message
  );
  return createTrainingHistoryRecord(session, generateEvaluation(session));
}

describe("today training recommendation", () => {
  it("starts with the short diagnosis scenario for a new learner", () => {
    expect(selectTodayScenario().id).toBe("export-slow");
  });

  it("targets the weakest skill and avoids the latest scenario", () => {
    const record = recordFor("dashboard-request", "谁每天使用这份周报，谁负责最后决定？");

    expect(selectTodayScenario([record]).id).toBe("ai-support-inaccuracy");
    expect(selectTodayScenario([record]).skillId).toBe("workflow");
  });

  it("falls back to an unseen scenario when the weakest skill is exhausted", () => {
    const records = [
      recordFor("dashboard-request", "谁每天使用这份周报？"),
      recordFor("ai-support-inaccuracy", "谁负责审核客服的回答？"),
      recordFor("training-completion-drop", "谁每天真正参加培训？")
    ];

    expect(selectTodayScenario(records).id).not.toBe("dashboard-request");
    expect(selectTodayScenario(records).id).not.toBe("ai-support-inaccuracy");
    expect(selectTodayScenario(records).id).not.toBe("training-completion-drop");
  });
});
