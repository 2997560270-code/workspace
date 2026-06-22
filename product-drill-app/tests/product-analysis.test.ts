import { describe, expect, it } from "vitest";
import { analyzeProduct } from "../src/lib/product-analysis";

describe("product analysis", () => {
  it("summarizes the product, asks five questions, and gives three suggestions", () => {
    const result = analyzeProduct({
      productName: "门店库存管理工具",
      productDescription: "帮助中小餐饮门店记录库存、提醒补货、减少损耗。",
      targetUsers: "中小餐饮门店老板和店长",
      coreFeatures: "库存记录、低库存提醒、损耗统计",
      productStage: "MVP",
      productUrl: "https://example.com"
    });

    expect(result.summary).toContain("门店库存管理工具");
    expect(result.summary).toContain("中小餐饮门店老板和店长");
    expect(result.questions).toHaveLength(5);
    expect(result.questions[0]).toContain("真实用户");
    expect(result.suggestions).toHaveLength(3);
    expect(result.suggestions.map((item) => item.stage)).toEqual(["短期可做", "中期验证", "长期方向"]);
  });
});
