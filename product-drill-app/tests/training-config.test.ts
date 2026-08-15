import { describe, expect, it } from "vitest";
import {
  DEFAULT_SCENARIO_ID,
  SKILLS,
  TRAINING_SCENARIOS,
  getScenario
} from "../src/lib/training-config";

describe("direction A training configuration", () => {
  it("ships twelve focused scenarios for the training map", () => {
    expect(TRAINING_SCENARIOS).toHaveLength(12);
    expect(TRAINING_SCENARIOS.map((scenario) => scenario.id)).toContain("dashboard-request");
    expect(TRAINING_SCENARIOS.every((scenario) => scenario.opening && scenario.hiddenFacts.workflow)).toBe(true);
  });

  it("uses the data dashboard request as the default diagnosis", () => {
    expect(DEFAULT_SCENARIO_ID).toBe("dashboard-request");
    expect(getScenario(DEFAULT_SCENARIO_ID).title).toContain("数据大屏");
  });

  it("defines the five evidence-based discovery skills", () => {
    expect(SKILLS.map((skill) => skill.id)).toEqual(["role", "workflow", "impact", "alternative", "metric"]);
  });
});
