import { z } from "zod";

// ── 世界治理状态 ─────────────────────────────────────────────────
export type WorldGovernanceStatus = "draft" | "review" | "approved" | "deprecated";
export type TransferRole = "calibration" | "intervention" | "transfer_test";
export type ChallengeRunStatus = "active" | "completed" | "abandoned";
export type WorldEventType = "user_action" | "world_response" | "reveal" | "intervention";
export type EventActor = "user" | "world" | "system";
export type DecisionConfidence = "high" | "medium" | "low";
export type InterventionType = "hint" | "feedback" | "counterfactual" | "reveal_consequence";
export type HypothesisConfidence = "high" | "medium" | "low" | "insufficient";
export type HypothesisEvidenceType = "supporting" | "counter" | "assisted" | "transfer";

// ── 不可变世界规则（model_forbidden_to_modify）────────────────────
export type HiddenFact = {
  id: string;
  content: string;
  reveal_condition_id: string;
  causal_significance: string;
};

export type CausalRule = {
  id: string;
  trigger_action: string;
  consequence_path: "premature" | "investigated";
  short_term: string;
  medium_term: string;
  long_term: string;
  counterfactual: string;
};

export type RoleInterest = {
  role: string;
  stated_position: string;
  true_interest: string;
  information_boundary: string;
};

export type RevealCondition = {
  id: string;
  trigger: string;
  reveals: string[];
};

export type BehaviorAnchor = {
  level: 1 | 3 | 5;
  description: string;
  observable_indicators: string[];
  anti_examples: string[];
};

export type ImmutableRules = {
  model_forbidden_to_modify: true;
  hidden_facts: HiddenFact[];
  causal_rules: CausalRule[];
  role_interests: RoleInterest[];
  reveal_conditions: RevealCondition[];
};

export type WorldAction = {
  id: string;
  label: string;
  category: "investigate" | "request_data" | "commit";
};

// ── 世界版本（不可变快照）────────────────────────────────────────
export type CausalWorldVersion = {
  world_id: string;
  version: string;
  target_habit: string;
  domain: string;
  governance_status: WorldGovernanceStatus;
  transfer_role: TransferRole;
  trigger_statement: string;
  visible_facts: string[];
  available_actions: WorldAction[];
  pressure_context: string;
  immutable_rules: ImmutableRules;
  behavior_anchors: {
    premature_commitment: BehaviorAnchor;
    adequate_investigation: BehaviorAnchor;
    model_behavior: BehaviorAnchor;
  };
  transfer_surface_differences: string[];
  approved_by: string | null;
  source_references: string[];
  created_at: string;
};

export const CausalWorldVersionSchema: z.ZodType<CausalWorldVersion> = z.object({
  world_id: z.string().min(1),
  version: z.string().min(1),
  target_habit: z.string().min(1),
  domain: z.string().min(1),
  governance_status: z.enum(["draft", "review", "approved", "deprecated"]),
  transfer_role: z.enum(["calibration", "intervention", "transfer_test"]),
  trigger_statement: z.string().min(1),
  visible_facts: z.array(z.string().min(1)),
  available_actions: z.array(
    z.object({
      id: z.string().min(1),
      label: z.string().min(1),
      category: z.enum(["investigate", "request_data", "commit"]),
    })
  ),
  pressure_context: z.string().min(1),
  immutable_rules: z.object({
    model_forbidden_to_modify: z.literal(true),
    hidden_facts: z.array(
      z.object({
        id: z.string().min(1),
        content: z.string().min(1),
        reveal_condition_id: z.string().min(1),
        causal_significance: z.string().min(1),
      })
    ),
    causal_rules: z.array(
      z.object({
        id: z.string().min(1),
        trigger_action: z.string().min(1),
        consequence_path: z.enum(["premature", "investigated"]),
        short_term: z.string().min(1),
        medium_term: z.string().min(1),
        long_term: z.string().min(1),
        counterfactual: z.string().min(1),
      })
    ),
    role_interests: z.array(
      z.object({
        role: z.string().min(1),
        stated_position: z.string().min(1),
        true_interest: z.string().min(1),
        information_boundary: z.string().min(1),
      })
    ),
    reveal_conditions: z.array(
      z.object({
        id: z.string().min(1),
        trigger: z.string().min(1),
        reveals: z.array(z.string().min(1)).min(1),
      })
    ),
  }),
  behavior_anchors: z.object({
    premature_commitment: z.object({
      level: z.literal(1),
      description: z.string().min(1),
      observable_indicators: z.array(z.string()),
      anti_examples: z.array(z.string()),
    }),
    adequate_investigation: z.object({
      level: z.literal(3),
      description: z.string().min(1),
      observable_indicators: z.array(z.string()),
      anti_examples: z.array(z.string()),
    }),
    model_behavior: z.object({
      level: z.literal(5),
      description: z.string().min(1),
      observable_indicators: z.array(z.string()),
      anti_examples: z.array(z.string()),
    }),
  }),
  transfer_surface_differences: z.array(z.string()),
  approved_by: z.string().min(1).nullable(),
  source_references: z.array(z.string().min(1)),
  created_at: z.string().min(1),
});

// ── 世界身份 ─────────────────────────────────────────────────────
export type CausalWorld = {
  id: string;
  target_habit: string;
  current_version: string;
  domain: string;
  governance_status: WorldGovernanceStatus;
  created_at: string;
  updated_at: string;
};

// ── 一次世界运行 ──────────────────────────────────────────────────
export type ChallengeRun = {
  id: string;
  user_id: string;
  world_id: string;
  world_version: string;
  model_version: string;
  status: ChallengeRunStatus;
  started_at: string;
  completed_at: string | null;
};

// ── 追加式事件时间线 ──────────────────────────────────────────────
export type WorldEvent = {
  id: string;
  run_id: string;
  event_type: WorldEventType;
  sequence_index: number;
  actor: EventActor;
  payload: Record<string, unknown>;
  created_at: string;
};

// ── 决策事件（后果揭示前持久化）──────────────────────────────────
export type DecisionEvent = {
  id: string;
  run_id: string;
  world_event_id: string;
  judgment: string;
  chosen_action: string;
  expected_outcome: string;
  confidence: DecisionConfidence;
  rejected_alternatives: string[];
  evidence_basis: string[];        // 作为依据的 world_event id 列表
  consequences_revealed: boolean;  // 后果揭示前必须为 false
  created_at: string;
};

// ── 干预（提示/反馈/反事实）──────────────────────────────────────
export type Intervention = {
  id: string;
  run_id: string;
  decision_event_id: string | null;
  intervention_type: InterventionType;
  content: string;
  model_version: string;
  world_version: string;
  triggered_at: string;
};

// ── 判断习惯假设 ──────────────────────────────────────────────────
export type JudgmentHypothesis = {
  id: string;
  user_id: string;
  habit_name: string;
  trigger_conditions: string[];
  confidence: HypothesisConfidence;
  supporting_evidence_ids: string[];
  counter_evidence_ids: string[];
  last_updated_at: string;
  created_at: string;
};

// ── 假设证据（关联决策事件与假设）────────────────────────────────
export type HypothesisEvidence = {
  id: string;
  hypothesis_id: string;
  decision_event_id: string;
  evidence_type: HypothesisEvidenceType;
  world_id: string;
  world_version: string;
  model_version: string;
  transfer_world_id: string | null;  // evidence_type = 'transfer' 时填入
  created_at: string;
};

// ── Zod Schemas（运行时校验）─────────────────────────────────────
export const DecisionEventSchema = z.object({
  id: z.string().min(1),
  run_id: z.string().min(1),
  world_event_id: z.string().min(1),
  judgment: z.string().min(1),
  chosen_action: z.string().min(1),
  expected_outcome: z.string().min(1),
  confidence: z.enum(["high", "medium", "low"]),
  rejected_alternatives: z.array(z.string()),
  evidence_basis: z.array(z.string()),
  consequences_revealed: z.boolean(),
  created_at: z.string(),
});

export const JudgmentHypothesisSchema = z.object({
  id: z.string().min(1),
  user_id: z.string().min(1),
  habit_name: z.string().min(1),
  trigger_conditions: z.array(z.string()),
  confidence: z.enum(["high", "medium", "low", "insufficient"]),
  supporting_evidence_ids: z.array(z.string()),
  counter_evidence_ids: z.array(z.string()),
  last_updated_at: z.string(),
  created_at: z.string(),
});

export const HypothesisEvidenceSchema = z.object({
  id: z.string().min(1),
  hypothesis_id: z.string().min(1),
  decision_event_id: z.string().min(1),
  evidence_type: z.enum(["supporting", "counter", "assisted", "transfer"]),
  world_id: z.string().min(1),
  world_version: z.string().min(1),
  model_version: z.string().min(1),
  transfer_world_id: z.string().nullable(),
  created_at: z.string(),
});

// ── 工厂函数（纯函数，无副作用）─────────────────────────────────
function uid(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function createChallengeRun(params: {
  userId: string;
  worldId: string;
  worldVersion: string;
  modelVersion: string;
}): ChallengeRun {
  return {
    id: uid("run"),
    user_id: params.userId,
    world_id: params.worldId,
    world_version: params.worldVersion,
    model_version: params.modelVersion,
    status: "active",
    started_at: new Date().toISOString(),
    completed_at: null,
  };
}

export function createWorldEvent(params: {
  runId: string;
  eventType: WorldEventType;
  sequenceIndex: number;
  actor: EventActor;
  payload: Record<string, unknown>;
}): WorldEvent {
  return {
    id: uid("evt"),
    run_id: params.runId,
    event_type: params.eventType,
    sequence_index: params.sequenceIndex,
    actor: params.actor,
    payload: params.payload,
    created_at: new Date().toISOString(),
  };
}

/**
 * 决策事件必须在后果揭示前创建。
 * consequences_revealed 初始值固定为 false，只能通过 revealConsequences() 变更。
 */
export function createDecisionEvent(params: {
  runId: string;
  worldEventId: string;
  judgment: string;
  chosenAction: string;
  expectedOutcome: string;
  confidence: DecisionConfidence;
  rejectedAlternatives: string[];
  evidenceBasis: string[];
}): DecisionEvent {
  return {
    id: uid("dec"),
    run_id: params.runId,
    world_event_id: params.worldEventId,
    judgment: params.judgment,
    chosen_action: params.chosenAction,
    expected_outcome: params.expectedOutcome,
    confidence: params.confidence,
    rejected_alternatives: params.rejectedAlternatives,
    evidence_basis: params.evidenceBasis,
    consequences_revealed: false,  // 不可在创建时设为 true
    created_at: new Date().toISOString(),
  };
}

/**
 * 揭示后果：返回新对象，不变更原对象（immutability）。
 */
export function revealConsequences(event: DecisionEvent): DecisionEvent {
  return { ...event, consequences_revealed: true };
}

export function createIntervention(params: {
  runId: string;
  decisionEventId: string | null;
  interventionType: InterventionType;
  content: string;
  modelVersion: string;
  worldVersion: string;
}): Intervention {
  return {
    id: uid("int"),
    run_id: params.runId,
    decision_event_id: params.decisionEventId,
    intervention_type: params.interventionType,
    content: params.content,
    model_version: params.modelVersion,
    world_version: params.worldVersion,
    triggered_at: new Date().toISOString(),
  };
}

export function createJudgmentHypothesis(params: {
  id?: string;
  userId: string;
  habitName: string;
  triggerConditions?: string[];
  confidence?: HypothesisConfidence;
}): JudgmentHypothesis {
  const now = new Date().toISOString();
  return {
    id: params.id ?? uid("hyp"),
    user_id: params.userId,
    habit_name: params.habitName,
    trigger_conditions: params.triggerConditions ?? [],
    confidence: params.confidence ?? "insufficient",
    supporting_evidence_ids: [],
    counter_evidence_ids: [],
    last_updated_at: now,
    created_at: now,
  };
}

export function createHypothesisEvidence(params: {
  evidenceId?: string;
  hypothesisId: string;
  decisionEventId: string;
  evidenceType: HypothesisEvidenceType;
  worldId: string;
  worldVersion: string;
  modelVersion: string;
  transferWorldId?: string;
}): HypothesisEvidence {
  return {
    id: params.evidenceId ?? uid("hyp-ev"),
    hypothesis_id: params.hypothesisId,
    decision_event_id: params.decisionEventId,
    evidence_type: params.evidenceType,
    world_id: params.worldId,
    world_version: params.worldVersion,
    model_version: params.modelVersion,
    transfer_world_id: params.transferWorldId ?? null,
    created_at: new Date().toISOString(),
  };
}

// ── 证据可追溯性校验 ──────────────────────────────────────────────
/**
 * 检查假设证据是否完整可追溯（event ID、world version、model version 均存在）。
 * 用于阻止低质量证据进入判断证据图谱。
 */
export function isEvidenceTraceable(ev: HypothesisEvidence): boolean {
  return (
    ev.decision_event_id.length > 0 &&
    ev.world_id.length > 0 &&
    ev.world_version.length > 0 &&
    ev.model_version.length > 0
  );
}

/**
 * 辅助证据（assisted）：决策事件创建前已有干预存在于同一 run。
 * 此函数判断一个证据是否可标记为独立证据（independent）。
 * @param runId 该证据所属的 challenge run id（需从 decision_event 中查得）
 */
export function isIndependentEvidence(
  evidence: HypothesisEvidence,
  interventionsInRun: Intervention[],
  runId: string
): boolean {
  if (evidence.evidence_type === "assisted") return false;
  // 若同一 run 中有任何 hint 干预，则不独立
  const priorHints = interventionsInRun.filter(
    (i) => i.run_id === runId && i.intervention_type === "hint"
  );
  return priorHints.length === 0;
}
