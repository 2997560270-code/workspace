export type IndustryScenario = {
  name: string;
  description: string;
};

export type TrainingMode = {
  name: string;
  description: string;
};

export const INDUSTRY_SCENARIOS: IndustryScenario[] = [
  { name: "AI+", description: "训练 AI 产品价值、落地边界和数据风险表达。" },
  { name: "B2B", description: "训练复杂决策链、预算约束和采购异议。" },
  { name: "企业培训", description: "训练培训效果、业务协同和组织落地问题。" },
  { name: "中小餐饮", description: "训练门店经营、库存损耗和老板决策场景。" },
  { name: "SaaS", description: "训练订阅价值、续费风险和功能优先级判断。" }
];

export const DEFAULT_SCENARIO = "AI+";

export const TRAINING_MODES: TrainingMode[] = [
  { name: "客户咨询", description: "AI 扮演客户挑战你的方案，你负责回应和论证。" },
  { name: "用户需求提出", description: "AI 先提出业务需求，你负责追问和澄清。" },
  { name: "方案评估", description: "用户提交方案后，AI 从需求、价值和落地风险进行点评。" }
];

export const DIFFICULTIES = ["基础", "标准", "严格"] as const;
