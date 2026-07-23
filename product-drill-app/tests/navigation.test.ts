import { describe, expect, it } from "vitest";
import { NAV_ITEMS, getViewMeta } from "../src/lib/navigation";

describe("direction A navigation metadata", () => {
  it("defines the four focused modules in order", () => {
    expect(NAV_ITEMS.map((item) => item.label)).toEqual([
      "今日训练",
      "训练地图",
      "复盘与复练",
      "我的能力"
    ]);
  });

  it("describes the evidence-led today view", () => {
    expect(getViewMeta("today").title).toContain("产品判断");
    expect(getViewMeta("review").description).toContain("改善");
  });
});
