export type ProductProfile = {
  productName: string;
  productDescription: string;
  targetUsers: string;
  coreFeatures: string;
  productStage: string;
  productUrl: string;
};

export type ProductSuggestion = {
  stage: "短期可做" | "中期验证" | "长期方向";
  content: string;
};

export type ProductAnalysis = {
  summary: string;
  questions: string[];
  suggestions: ProductSuggestion[];
};

export function analyzeProduct(profile: ProductProfile): ProductAnalysis {
  return {
    summary: `${profile.productName} 面向 ${profile.targetUsers}，当前阶段是 ${profile.productStage}。它通过 ${profile.coreFeatures} 来解决：${profile.productDescription}`,
    questions: [
      "真实用户是谁：每天打开产品的人、决策购买的人、最终付费的人是否一致？",
      "真实场景是什么：用户在什么时候、什么压力下会想起这个产品？",
      "真实问题是什么：现在库存、补货或损耗问题给用户造成了多少成本？",
      "替代方案是什么：用户不用这个产品时，正在用 Excel、纸笔还是现有系统解决？",
      "验证指标是什么：上线后用什么数据证明产品真的减少损耗或提升效率？"
    ],
    suggestions: [
      { stage: "短期可做", content: "把目标用户和核心使用场景写得更窄，先服务一个最痛的门店角色。" },
      { stage: "中期验证", content: "用 3-5 家真实门店验证低库存提醒和损耗统计是否带来可量化改善。" },
      { stage: "长期方向", content: "在库存数据稳定后，再考虑采购建议、供应商协同或多门店管理。" }
    ]
  };
}
