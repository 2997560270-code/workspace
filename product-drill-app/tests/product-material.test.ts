import { describe, expect, it } from "vitest";
import { generateProductMaterial } from "../src/lib/product-material";

describe("product material experiment", () => {
  it("turns a product judgment into a bounded draft", () => {
    const draft = generateProductMaterial({
      productName: "库存助手",
      targetUser: "门店店长",
      problem: "临期商品经常漏处理",
      currentWorkflow: "闭店前人工检查",
      evidence: "三家门店访谈",
      stage: "早期验证"
    });

    expect(draft.oneLiner).toContain("库存助手");
    expect(draft.problem).toContain("闭店前人工检查");
    expect(draft.evidenceBoundary).toContain("不能替代真实用户");
    expect(draft.openQuestions).toHaveLength(3);
  });

  it("keeps missing evidence explicit instead of inventing it", () => {
    const draft = generateProductMaterial({ productName: "工具", targetUser: "运营", problem: "流程慢", currentWorkflow: "", evidence: "", stage: "" });

    expect(draft.evidenceBoundary).toContain("没有填写真实依据");
    expect(draft.validationPlan).toContain("3—5 位运营");
  });
});
