export type IndustryScenario = {
  name: string;
  description: string;
};

export type TrainingMode = {
  name: string;
  description: string;
};

export const INDUSTRY_SCENARIOS: IndustryScenario[] = [
  { name: "B2B", description: "训练复杂决策链、预算约束和采购异议。" },
  { name: "AI+", description: "训练 AI 产品价值、落地边界和数据风险表达。" },
  { name: "企业员工培训", description: "训练培训效果、业务协同和组织落地问题。" }
];

export const DEFAULT_SCENARIO = "AI+";

export const TRAINING_MODES: TrainingMode[] = [
  {
    name: "用户需求提出",
    description: "AI 先提出业务需求，你负责追问和澄清。"
  },
  {
    name: "客户咨询",
    description: "AI 扮演客户挑战你的方案，你负责回应和论证。"
  }
];
