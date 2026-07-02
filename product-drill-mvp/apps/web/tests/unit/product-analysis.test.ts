import { describe, expect, it } from "vitest";
import { analyzeProduct } from "../../src/features/products/product-analysis";

describe("product analysis migration", () => {
  it("summarizes a product, asks at least five questions and returns staged suggestions", () => {
    const analysis = analyzeProduct({
      productName: "门店库存管理工具",
      productDescription: "帮助中小餐饮门店记录库存、提醒补货并统计损耗。",
      targetUsers: "中小餐饮门店老板和店长",
      coreFeatures: "库存记录、低库存提醒、损耗统计",
      productStage: "MVP 验证",
      productUrl: "https://example.com"
    });

    expect(analysis.summary).toContain("门店库存管理工具");
    expect(analysis.summary).toContain("中小餐饮门店老板和店长");
    expect(analysis.questions.length).toBeGreaterThanOrEqual(5);
    expect(analysis.suggestions.map((item) => item.stage)).toEqual(["短期可做", "中期验证", "长期方向"]);
  });
});
