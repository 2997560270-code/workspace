export type ProductMaterialInput = {
  productName: string;
  targetUser: string;
  problem: string;
  currentWorkflow: string;
  evidence: string;
  stage: string;
};

export type ProductMaterialDraft = {
  title: string;
  oneLiner: string;
  audience: string;
  problem: string;
  evidenceBoundary: string;
  validationPlan: string;
  openQuestions: string[];
};

export function generateProductMaterial(input: ProductMaterialInput): ProductMaterialDraft {
  const productName = input.productName.trim() || "未命名产品";
  const targetUser = input.targetUser.trim() || "尚未确认的目标用户";
  const problem = input.problem.trim() || "尚未确认的核心问题";
  const workflow = input.currentWorkflow.trim();
  const evidence = input.evidence.trim();
  const stage = input.stage.trim() || "当前阶段未填写";

  return {
    title: `${productName} 产品资料草稿`,
    oneLiner: `${productName} 面向${targetUser}，当前聚焦于${problem}。`,
    audience: `${targetUser}（产品阶段：${stage}）`,
    problem: workflow ? `${problem} 当前发生在：${workflow}` : problem,
    evidenceBoundary: evidence
      ? `已有依据：${evidence}。这仍是训练输入，不能替代真实用户或业务数据。`
      : "当前没有填写真实依据，不能把这份草稿当作市场结论。",
    validationPlan: `先与 3—5 位${targetUser}访谈，复现当前流程并记录${problem}的发生频率、代价和替代方案，再决定是否扩大投入。`,
    openQuestions: [
      `谁每天使用${productName}，谁负责购买或最终决策？`,
      "用户现在如何绕过这个问题，为什么现有方法仍然不够？",
      "什么可观察的行为变化能证明问题真的被改善？"
    ]
  };
}
