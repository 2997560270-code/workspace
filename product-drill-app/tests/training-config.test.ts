import { describe, expect, it } from "vitest";
import { DEFAULT_SCENARIO, INDUSTRY_SCENARIOS, TRAINING_MODES } from "../src/lib/training-config";

describe("training configuration", () => {
  it("keeps the MVP scenario set small and ordered", () => {
    expect(INDUSTRY_SCENARIOS.map((scenario) => scenario.name)).toEqual([
      "B2B",
      "AI+",
      "企业员工培训"
    ]);
  });

  it("uses AI+ as the default scenario", () => {
    expect(DEFAULT_SCENARIO).toBe("AI+");
  });

  it("supports the two MVP training modes with clear descriptions", () => {
    expect(TRAINING_MODES.map((mode) => mode.name)).toEqual(["用户需求提出", "客户咨询"]);
    expect(TRAINING_MODES.every((mode) => mode.description.length > 0)).toBe(true);
  });
});
