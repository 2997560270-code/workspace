import { describe, expect, it } from "vitest";

import { buildEvaluationPrompt, buildRoleplayPrompt, scenarioFacts } from "../src/lib/ai/prompts";
import { TrainingScenarioSchema } from "../src/lib/api/schemas";
import { TRAINING_SCENARIOS, getScenario, resolveSessionScenario } from "../src/lib/training-config";
import { createTrainingSession } from "../src/lib/training-session";

describe("business background prompt injection", () => {
  it("ships a real-case business background for every built-in scenario", () => {
    for (const scenario of TRAINING_SCENARIOS) {
      expect(scenario.background?.length, scenario.id).toBeGreaterThan(2);
      expect(scenario.backgroundSource, scenario.id).toBeTruthy();
    }
  });

  it("injects the business background into the roleplay prompt", () => {
    const session = createTrainingSession({ scenarioId: "dashboard-request", mode: "训练" });
    const prompt = buildRoleplayPrompt(session, "你们现在的流程是怎么完成的？");
    expect(prompt).toContain("BUSINESS BACKGROUND RULES");
    expect(prompt).toContain("48 家门店");
    expect(prompt).toContain("三个城市");
    expect(prompt).toContain("SCENARIO FACTS");
  });

  it("ignores a tampered client snapshot for built-in scenarios", () => {
    const base = getScenario("dashboard-request");
    const tampered = {
      ...base,
      background: ["被篡改的业务背景"],
      hiddenFacts: { ...base.hiddenFacts, workflow: "被篡改的隐藏事实" }
    };
    const session = createTrainingSession({ scenarioId: "dashboard-request", scenario: tampered, mode: "训练" });
    expect(resolveSessionScenario(session)).toBe(base);
    const prompt = buildRoleplayPrompt(session, "现在流程是什么？");
    expect(prompt).not.toContain("被篡改的业务背景");
    expect(prompt).not.toContain("被篡改的隐藏事实");
    expect(prompt).toContain("一家直营 48 家门店的连锁零售企业");
  });

  it("uses the session snapshot for custom scenarios outside the config table", () => {
    const custom = { ...getScenario("dashboard-request"), id: "custom-demo", background: ["自定义场景的业务背景"] };
    const session = createTrainingSession({ scenarioId: "custom-demo", scenario: custom, mode: "训练" });
    expect(resolveSessionScenario(session)).toBe(custom);
    expect(buildRoleplayPrompt(session, "现在流程是什么？")).toContain("自定义场景的业务背景");
  });

  it("injects scenario background into the evaluation prompt without weakening the citation contract", () => {
    const session = createTrainingSession({ scenarioId: "sales-lost-deals", mode: "训练" });
    const prompt = buildEvaluationPrompt(session);
    expect(prompt).toContain("SCENARIO BACKGROUND (reference only");
    expect(prompt).toContain("Clozd");
    expect(prompt).toContain("Cite only these message ids");
    expect(prompt).toContain("background references belong only in why/nextAction");
  });

  it("keeps background fields when a session snapshot passes the API schema", () => {
    const base = getScenario("dashboard-request");
    const parsed = TrainingScenarioSchema.parse(base);
    expect(parsed.background).toEqual(base.background);
    expect(parsed.backgroundSource).toBe(base.backgroundSource);
  });
});
