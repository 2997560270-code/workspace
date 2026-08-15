import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCustomScenario, isCustomScenarioId, loadCustomScenarios, saveCustomScenario } from "../src/lib/custom-scenarios";

const input = {
  title: "仓库盘点异常",
  industry: "物流 SaaS",
  role: "仓储运营负责人",
  context: "月底盘点时团队发现库存差异。",
  opening: "我们需要一个库存差异提醒功能。",
  skillId: "workflow" as const,
  hiddenFacts: {
    role: "仓库主管每天复核，财务只看月报。",
    workflow: "员工先导出表格，再逐项比对系统和实盘。",
    impact: "每次盘点约有 8% 的 SKU 需要人工复核。",
    alternative: "团队用共享表格记录异常，但没有统一入口。",
    metric: "盘点复核时间从两天降到半天，差异率可追溯。"
  }
};

describe("custom scenarios", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        clear: () => values.clear()
      }
    });
  });

  it("creates a local-only scenario with all hidden facts", () => {
    const scenario = createCustomScenario(input);
    expect(isCustomScenarioId(scenario.id)).toBe(true);
    expect(scenario.hiddenFacts.workflow).toContain("导出表格");
    expect(scenario.briefing[0]).toContain("本地");
  });

  it("persists and validates custom scenarios in local storage", () => {
    const scenario = createCustomScenario(input);
    saveCustomScenario(scenario);
    expect(loadCustomScenarios()).toEqual([scenario]);
    window.localStorage.setItem("product-drill-custom-scenarios-v1", "not-json");
    expect(loadCustomScenarios()).toEqual([]);
  });
});
