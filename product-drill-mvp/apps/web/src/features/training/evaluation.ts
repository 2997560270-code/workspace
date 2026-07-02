import type { TrainingSession } from "./training-session";

export const SCORE_DIMENSIONS = [
  "需求理解",
  "问题澄清",
  "方案设计",
  "异议应对",
  "商业价值论证",
  "数据与逻辑",
  "表达与沟通"
];

export type ScoreDimension = {
  name: string;
  score: number;
};

export type Evaluation = {
  totalScore: number;
  dimensions: ScoreDimension[];
  issues: string[];
};

export function generateEvaluation(session: TrainingSession): Evaluation {
  const userMessages = session.messages.filter((message) => message.role === "user");
  const base = Math.min(3.8, 2.6 + userMessages.length * 0.3);
  const dimensions = SCORE_DIMENSIONS.map((name, index) => ({
    name,
    score: Number(Math.max(2, base - (index % 3) * 0.2).toFixed(1))
  }));

  return {
    totalScore: Number((dimensions.reduce((sum, item) => sum + item.score, 0) / dimensions.length).toFixed(1)),
    dimensions,
    issues: [
      "目标用户还不够具体，需要明确谁每天使用、谁决策、谁付费。",
      "方案价值需要绑定可验证指标，例如转化率、完成率、节省时间或成本。",
      "对客户异议的回应还偏概念化，需要补充预算、落地周期和风险处理。"
    ]
  };
}
