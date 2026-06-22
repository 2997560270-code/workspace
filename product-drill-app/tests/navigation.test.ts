import { describe, expect, it } from "vitest";
import { NAV_ITEMS, getViewMeta } from "../src/lib/navigation";

describe("navigation metadata", () => {
  it("defines the five MVP modules in order", () => {
    expect(NAV_ITEMS.map((item) => item.label)).toEqual([
      "工作台",
      "我的产品",
      "对话历史",
      "能力画像",
      "场景库"
    ]);
  });

  it("returns title and description for every module", () => {
    for (const item of NAV_ITEMS) {
      const meta = getViewMeta(item.view);

      expect(meta.title.length).toBeGreaterThan(0);
      expect(meta.description.length).toBeGreaterThan(0);
    }
  });
});
