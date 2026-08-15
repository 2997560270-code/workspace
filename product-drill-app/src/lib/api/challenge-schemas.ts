import { z } from "zod";

// ── 创建 challenge run ────────────────────────────────────────────
export const CreateChallengeRunBodySchema = z.object({
  world_id: z.string().min(1).max(100),
  world_version: z.string().min(1).max(50),
});

// ── 追加用户动作（world event）────────────────────────────────────
export const AppendActionBodySchema = z.object({
  sequence_index: z.number().int().nonnegative(),
  actor: z.enum(["user", "world", "system"]),
  event_type: z.enum(["user_action", "world_response", "reveal", "intervention"]),
  // payload 仅限 string 值，防止任意 JSON 注入
  payload: z.record(z.string(), z.string().max(8000)).default({}),
});

/**
 * Ambiguous learner input is retained for audit, but cannot be promoted to
 * structured discovery evidence by carrying a discovery dimension.
 */
export function prepareLearnerEventPayload(
  payload: Record<string, string>,
  ineligible: boolean,
  status: "ambiguous" | "ineligible" | "no_new_fact" = "ambiguous"
): Record<string, string> {
  if (!ineligible) return payload;
  const { discovery_dimension: _discoveryDimension, ...rest } = payload;
  return { ...rest, input_status: status };
}

// ── 提交决策事件（后果揭示前）────────────────────────────────────
export const CreateDecisionBodySchema = z.object({
  world_event_id: z.string().min(1).max(100),
  judgment: z.string().min(1).max(4000),
  chosen_action: z.string().min(1).max(4000),
  expected_outcome: z.string().min(1).max(4000),
  confidence: z.enum(["high", "medium", "low"]),
  rejected_alternatives: z.array(z.string().max(2000)).max(10).default([]),
  // evidence_basis 引用同一 run 内的 world_event id
  evidence_basis: z.array(z.string().max(100)).max(20).default([]),
});

// ── 揭示后果 ──────────────────────────────────────────────────────
export const RevealConsequencesBodySchema = z.object({
  decision_event_id: z.string().min(1).max(100),
});

// ── 记录干预 ──────────────────────────────────────────────────────
export const CreateInterventionBodySchema = z.object({
  decision_event_id: z.string().max(100).nullable().default(null),
  intervention_type: z.enum(["hint", "feedback", "counterfactual", "reveal_consequence"]),
  content: z.string().min(1).max(8000),
});

// ── API 响应类型 ──────────────────────────────────────────────────
export type ChallengeRunResponse = {
  id: string;
  world_id: string;
  world_version: string;
  model_version: string;
  status: "active" | "completed" | "abandoned";
  started_at: string;
  unofficial: boolean; // 确定性演示 = true，不进入正式画像
};

export type DecisionEventResponse = {
  id: string;
  run_id: string;
  consequences_revealed: boolean;
  created_at: string;
};

export type JudgmentProfileResponse = {
  hypotheses: Array<{
    id: string;
    habit_name: string;
    confidence: string;
    trigger_conditions: string[];
    supporting_evidence_count: number;
    counter_evidence_count: number;
    last_updated_at: string;
  }>;
};
