import { describe, expect, it } from "vitest";
import { generateEvaluation } from "../src/lib/evaluation";
import { compareScenarioRecords } from "../src/lib/scenario-comparison";
import { createTrainingHistoryRecord } from "../src/lib/training-history";
import { createTrainingSession, sendTrainingMessage } from "../src/lib/training-session";

function records() {
  const firstSession = sendTrainingMessage(
    createTrainingSession({ scenarioId: "dashboard-request", mode: "独立" }),
    "谁每天使用这份周报？"
  );
  const secondSession = sendTrainingMessage(
    sendTrainingMessage(
      createTrainingSession({ scenarioId: "dashboard-request", mode: "独立" }),
      "谁每天使用这份周报？"
    ),
    "目前完整流程是怎么完成的？"
  );
  const first = {
    ...createTrainingHistoryRecord(firstSession, generateEvaluation(firstSession)),
    id: "first",
    completedAt: "2026-08-01T00:00:00.000Z"
  };
  const second = {
    ...createTrainingHistoryRecord(secondSession, generateEvaluation(secondSession)),
    id: "second",
    completedAt: "2026-08-02T00:00:00.000Z"
  };
  return { first, second };
}

describe("same-scenario comparison", () => {
  it("compares adjacent same-mode records and identifies improved skills", () => {
    const { first, second } = records();
    const comparison = compareScenarioRecords([second, first], second);

    expect(comparison?.baseline.id).toBe("first");
    expect(comparison?.scoreDelta).toBeGreaterThan(0);
    expect(comparison?.improvedSkills).toContain("场景与当前流程");
  });

  it("does not compare records from a different mode", () => {
    const { first, second } = records();
    const strict = { ...second, id: "strict", mode: "严格" as const };

    expect(compareScenarioRecords([first, strict], strict)).toBeNull();
  });
});
