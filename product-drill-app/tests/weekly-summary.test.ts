import { describe, expect, it } from "vitest";
import { generateEvaluation } from "../src/lib/evaluation";
import { createTrainingHistoryRecord } from "../src/lib/training-history";
import { createTrainingSession, sendTrainingMessage } from "../src/lib/training-session";
import { buildWeeklyTrainingSummary } from "../src/lib/weekly-summary";

function record(completedAt: string, message: string) {
  const session = sendTrainingMessage(
    createTrainingSession({ scenarioId: "dashboard-request", mode: "独立" }),
    message
  );
  return { ...createTrainingHistoryRecord(session, generateEvaluation(session)), completedAt };
}

describe("weekly training summary", () => {
  it("counts only records from the current Monday-to-now window", () => {
    const summary = buildWeeklyTrainingSummary([
      record("2026-08-10T09:00:00.000Z", "目前流程是怎么完成的？"),
      record("2026-08-03T09:00:00.000Z", "谁每天使用这份周报？")
    ], new Date("2026-08-12T12:00:00.000Z"));

    expect(summary.totalSessions).toBe(1);
    expect(summary.averageScore).not.toBeNull();
  });

  it("reports improvement count and the lowest-scoring focus skill", () => {
    const summary = buildWeeklyTrainingSummary([
      { ...record("2026-08-11T09:00:00.000Z", "目前流程是怎么完成的？"), retry: { issueId: "x", targetSkill: "impact", answer: "多久发生一次？", improved: true, feedback: "已改善" } }
    ], new Date("2026-08-12T12:00:00.000Z"));

    expect(summary.improvedCount).toBe(1);
    expect(summary.focusSkill).toBe("用户与角色识别");
  });

  it("returns an empty summary when there is no current-week record", () => {
    expect(buildWeeklyTrainingSummary([], new Date("2026-08-12T12:00:00.000Z"))).toEqual({
      totalSessions: 0,
      improvedCount: 0,
      averageScore: null,
      focusSkill: null
    });
  });
});
