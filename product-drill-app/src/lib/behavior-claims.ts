export const DISCOVERY_DIMENSIONS = ["workflow", "consequence", "alternative"] as const;

export type DiscoveryDimension = (typeof DISCOVERY_DIMENSIONS)[number];
export type DiscoveryReadiness =
  | "insufficient"
  | "problem_hypothesis"
  | "opportunity_hypothesis"
  | "solution_exploration";

export const REQUIRED_FORBIDDEN_INFERENCES = [
  "overall_PM_competency",
  "hiring_fit",
  "personality_trait",
  "permanent_trait",
  "message_count",
  "text_length",
  "keyword_usage",
  "same_world_correction_as_transfer",
] as const;

export const PREMATURE_SOLUTION_COMMITMENT_CLAIM = {
  id: "premature_solution_commitment",
  version: "0.3.0",
  governance_status: "approved",
  definition:
    "在发现信息尚未达到最低证据门槛时，直接输出具体功能、原型方向、技术选型或排期承诺。",
  trigger_conditions: [
    { id: "T-01", description: "用户描述了痛点或需求场景。" },
    { id: "T-02", description: "用户要求产品经理直接给出解决方案。" },
    { id: "T-03", description: "已经获得部分发现信息，但信息仍不完整。" },
    { id: "T-04", description: "用户以具体功能或方案请求发起对话。" },
    { id: "T-05", description: "竞品、客户、指标或内部权威带来方案压力。" },
  ],
  evidence: {
    standalone: [
      "SE-01: 缺少工作流或问题后果信息时直接输出具体方案。",
      "SE-02: 面对用户提出的具体方案请求，未还原问题叙述就接受并细化方案。",
    ],
    auxiliary: [
      "AE-01: 追问方向只用于细化方案，而非深化问题。",
      "AE-02: 跳过已经暴露的缺失发现维度。",
      "AE-03: 问题本质未确认时给出技术选型或 UI 描述。",
    ],
    same_world_correction:
      "同一世界中经提示后修正只表示理解反馈，不构成能力迁移证据。",
    transfer:
      "只有在表面不同的第三世界中未经提示推迟方案承诺，才构成模拟迁移证据。",
  },
  low_confidence_conditions: [
    "无法确认当前是否处于发现阶段。",
    "用户已经主动提供全部发现维度。",
    "明确将方案作为讨论起点且后续继续调查。",
    "只有单次观察，缺少重复触发。",
  ],
  forbidden_inferences: REQUIRED_FORBIDDEN_INFERENCES,
  approved_on: "2026-08-03",
} as const;

export function assessDiscoveryReadiness(
  dimensions: Iterable<DiscoveryDimension>
): DiscoveryReadiness {
  const covered = new Set(dimensions);

  if (DISCOVERY_DIMENSIONS.every((dimension) => covered.has(dimension))) {
    return "solution_exploration";
  }

  if (covered.has("workflow") && covered.has("consequence")) {
    return "opportunity_hypothesis";
  }

  if (covered.size >= 2) {
    return "problem_hypothesis";
  }

  return "insufficient";
}

