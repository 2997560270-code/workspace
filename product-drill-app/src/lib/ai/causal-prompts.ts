import type { CausalWorldVersion, WorldEvent, DecisionEvent } from "../causal-world";
import {
  PREMATURE_SOLUTION_COMMITMENT_CLAIM,
  REQUIRED_FORBIDDEN_INFERENCES,
} from "../behavior-claims";
import type { BehaviorObservation } from "./causal-pipeline";

export type NarratorAllowedFact = {
  id: string;
  content: string;
};

export function getNarratorAllowedFacts(
  worldVersion: CausalWorldVersion,
  revealedFactIds: string[]
): NarratorAllowedFact[] {
  const visibleFacts: NarratorAllowedFact[] = [
    { id: "scenario-trigger", content: worldVersion.trigger_statement },
    ...worldVersion.visible_facts.map((content, index) => ({
      id: `visible-${index + 1}`,
      content,
    })),
  ];
  const revealedFacts = worldVersion.immutable_rules.hidden_facts
    .filter((fact) => revealedFactIds.includes(fact.id))
    .map((fact) => ({ id: fact.id, content: fact.content }));

  return [...visibleFacts, ...revealedFacts];
}

// ── World Narrator prompt ─────────────────────────────────────────
export function buildWorldNarratorPrompt(params: {
  worldVersion: CausalWorldVersion;
  userAction: string;
  eventHistory: WorldEvent[];
  revealedFactIds: string[];
}): string {
  const { worldVersion, userAction, eventHistory, revealedFactIds } = params;

  const allowedFacts = getNarratorAllowedFacts(worldVersion, revealedFactIds);
  const activeRole = worldVersion.immutable_rules.role_interests[0];
  const recentLearnerActions = eventHistory
    .filter((event) => event.actor === "user" && typeof event.payload.text === "string")
    .slice(-4)
    .map((event) => ({ id: event.id, text: event.payload.text }));

  return [
    "你是产品判断训练场景中的真实业务角色。你的回答要像正常对话，不要像规则引擎、菜单或考试提示。",
    "",
    "当前角色：",
    JSON.stringify(
      {
        role: activeRole?.role ?? "场景角色",
        stated_position: activeRole?.stated_position ?? "",
        information_boundary: activeRole?.information_boundary ?? "",
      },
      null,
      2
    ),
    "",
    "允许使用的事实（唯一事实来源）：",
    JSON.stringify(allowedFacts, null, 2),
    "",
    "最近的学习者输入：",
    JSON.stringify(recentLearnerActions, null, 2),
    "",
    "本轮学习者输入：",
    userAction,
    "",
    "回应规则：",
    "1. 先判断本轮输入是否与当前场景相关。只要涉及当前需求、用户、目标、范围、现状、数据、影响、风险、成本、约束或替代方案，就视为相关；不要求用户使用预设短语。",
    "2. 相关时 response_type=role_reply。直接回答用户真正问的内容，不要复述调查菜单，也不要要求用户按固定格式重写。",
    "3. 相关但允许事实不足以确定答案时，明确说哪一点尚未确定，再提出最多一个有针对性的澄清问题；不要只说“信息不足”。",
    "4. 明显与当前场景无关时 response_type=clarification，简短说明偏离场景并提示回到当前产品问题，cited_fact_ids 返回空数组。",
    "5. 只能使用允许事实中的内容，不得添加人物动作、表情、情绪、预算、排期、指标、团队反应或其他未提供的细节。",
    "6. 只有学习者明确表达承诺时，才能把输入视为承诺。不得评价、指导、总结或打分，也不得解释训练后果。",
    "7. 使用自然、具体的中文，2-4 句话、180 个汉字以内，不使用 Markdown，不使用“确定性模式”“受治理事实”“触发词”等系统术语。",
    "8. role_reply 的 cited_fact_ids 至少引用一个允许事实 id；clarification 不引用事实。",
  ].join("\n");
}

// ── Behavior Observer prompt ──────────────────────────────────────
export function buildBehaviorObserverPrompt(params: {
  worldVersion: CausalWorldVersion;
  decisionEvent: DecisionEvent;
  eventHistory: WorldEvent[];
  behaviorAnchors: CausalWorldVersion["behavior_anchors"];
  wasAssisted: boolean;
}): string {
  const { worldVersion, decisionEvent, eventHistory, behaviorAnchors, wasAssisted } = params;

  const validEventIds = eventHistory.map((e) => e.id);
  const claim = PREMATURE_SOLUTION_COMMITMENT_CLAIM;

  return [
    "You are Behavior Observer for a PM judgment training system.",
    "Your task: extract OBSERVABLE behaviors from the learner's decision event.",
    "You must NOT infer, fabricate, or score abilities beyond what the evidence shows.",
    "",
    `TARGET HABIT: ${claim.id} (claim version ${claim.version})`,
    `APPROVED DEFINITION: ${claim.definition}`,
    "Three dimensions must be investigated BEFORE committing to a solution:",
    "  - workflow: current workflow / who does what / frequency",
    "  - consequence: problem impact / business cost / urgency",
    "  - alternative: existing workarounds / tried solutions",
    "",
    "BEHAVIOR ANCHORS (from world version):",
    JSON.stringify(behaviorAnchors, null, 2),
    "",
    "DECISION EVENT (submitted BEFORE consequences were revealed):",
    JSON.stringify(
      {
        id: decisionEvent.id,
        judgment: decisionEvent.judgment,
        chosen_action: decisionEvent.chosen_action,
        expected_outcome: decisionEvent.expected_outcome,
        confidence: decisionEvent.confidence,
        rejected_alternatives: decisionEvent.rejected_alternatives,
        evidence_basis: decisionEvent.evidence_basis,
      },
      null,
      2
    ),
    "",
    "EVENT HISTORY (valid event ids you may cite):",
    JSON.stringify(
      eventHistory.map((e) => ({ id: e.id, type: e.event_type, actor: e.actor, payload: e.payload })),
      null,
      2
    ),
    "",
    `ASSISTED: ${wasAssisted} (if true, behavior cannot be classified as independent evidence)`,
    "",
    "VALID EVENT IDs you must cite from:",
    validEventIds.join(", "),
    "",
    "RULES (strictly enforced):",
    "- evidence_event_ids must only contain ids from the list above. Never invent ids.",
    "- If the learner did not investigate a dimension, list it in missing_dimensions. Do NOT assume it was covered.",
    "- confidence = 'low' when fewer than 2 dimensions were covered. Set insufficient_reason.",
    "- Do NOT produce behavior conclusions when confidence = 'low'.",
    "- Do NOT infer that the learner knew something they did not explicitly express.",
    "- assisted = true means this observation cannot contribute to independent evidence.",
    "- Never output totalScore, keyword counts, or message length as evidence.",
  ].join("\n");
}

// ── Hypothesis Updater prompt ─────────────────────────────────────
export function buildHypothesisUpdaterPrompt(params: {
  habitName: string;
  currentConfidence: string;
  currentTriggerConditions: string[];
  // Fix: use the canonical exported type instead of an inline shape that
  // omitted insufficient_reason and model_version, risking silent divergence.
  behaviorObservation: BehaviorObservation;
  worldId: string;
  worldVersion: string;
  isTransferWorld: boolean;
}): string {
  const { habitName, currentConfidence, currentTriggerConditions, behaviorObservation, worldId, worldVersion, isTransferWorld } = params;

  return [
    "You are Hypothesis Updater for a PM judgment training system.",
    "Update the learner's judgment habit hypothesis based on this observation.",
    "",
    `HABIT: ${habitName}`,
    `CURRENT CONFIDENCE: ${currentConfidence}`,
    `KNOWN TRIGGER CONDITIONS: ${JSON.stringify(currentTriggerConditions)}`,
    "",
    "BEHAVIOR OBSERVATION (from Behavior Observer):",
    JSON.stringify(behaviorObservation, null, 2),
    "",
    // Fix (HIGH): explicitly surface assisted status so AI doesn't miss it in JSON
    `ASSISTED: ${behaviorObservation.assisted} (if true, this decision had pre-decision hints and cannot be counted as independent evidence)`,
    "",
    `WORLD: ${worldId} (version ${worldVersion})`,
    `IS TRANSFER WORLD (novel, surface-dissimilar to training world): ${isTransferWorld}`,
    "",
    "RULES (strictly enforced):",
    "- update_direction = 'supports' only when missing_dimensions is non-empty AND confidence != 'low'.",
    "- update_direction = 'contradicts' only when all 3 dimensions were covered AND confidence != 'low'.",
    "- update_direction = 'insufficient' when observation.confidence = 'low'.",
    "- updated_confidence = 'insufficient' if this is the first observation and confidence = 'low'.",
    "- If observation.assisted = true, this cannot produce 'independent' evidence; note that in rationale.",
    "- referenced_evidence_ids must only contain ids that appear in the observation's evidence_event_ids.",
    "- forbidden_inferences_confirmed must include at minimum: 'overall_PM_competency', 'hiring_fit', 'permanent_trait'.",
    "- Do NOT infer the learner's intent, motivation, or trait from a single observation.",
    "- Same-world correction does NOT constitute transfer evidence, even if behavior improved.",
    `- Confirm every forbidden inference boundary: ${REQUIRED_FORBIDDEN_INFERENCES.join(", ")}.`,
  ].join("\n");
}
