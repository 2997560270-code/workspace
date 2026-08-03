import type { CausalWorldVersion, WorldEvent, DecisionEvent } from "../causal-world";
import {
  PREMATURE_SOLUTION_COMMITMENT_CLAIM,
  REQUIRED_FORBIDDEN_INFERENCES,
} from "../behavior-claims";
import type { BehaviorObservation } from "./causal-pipeline";

// ── World Narrator prompt ─────────────────────────────────────────
export function buildWorldNarratorPrompt(params: {
  worldVersion: CausalWorldVersion;
  userAction: string;
  eventHistory: WorldEvent[];
  revealedFactIds: string[];
}): string {
  const { worldVersion, userAction, eventHistory, revealedFactIds } = params;

  // 只暴露已揭示事实，不暴露全部隐藏事实
  const visibleFacts = [
    ...worldVersion.visible_facts,
    ...worldVersion.immutable_rules.hidden_facts
      .filter((f) => revealedFactIds.includes(f.id))
      .map((f) => f.content),
  ];

  return [
    "You are World Narrator for a causal scenario world used in PM judgment training.",
    "",
    "WORLD VERSION (immutable — you must not contradict or extend these facts):",
    JSON.stringify(
      {
        world_id: worldVersion.world_id,
        version: worldVersion.version,
        target_habit: worldVersion.target_habit,
        domain: worldVersion.domain,
        governance_status: worldVersion.governance_status,
        pressure_context: worldVersion.pressure_context,
        model_forbidden_to_modify:
          worldVersion.immutable_rules.model_forbidden_to_modify,
        trigger_statement: worldVersion.trigger_statement,
        role_interests: worldVersion.immutable_rules.role_interests.map((r) => ({
          role: r.role,
          stated_position: r.stated_position,
          information_boundary: r.information_boundary,
          // true_interest is NOT disclosed to narrator unless explicitly revealed
        })),
        reveal_conditions: worldVersion.immutable_rules.reveal_conditions,
        visible_facts: visibleFacts,
      },
      null,
      2
    ),
    "",
    "EVENT HISTORY (most recent last):",
    JSON.stringify(
      eventHistory.slice(-10).map((e) => ({ type: e.event_type, actor: e.actor, payload: e.payload })),
      null,
      2
    ),
    "",
    "LEARNER ACTION:",
    userAction,
    "",
    "RULES (strictly enforced):",
    "- model_forbidden_to_modify=true is authoritative: model output can narrate but cannot change world truth.",
    "- Narrate only within the world version above. Never create new facts, budgets, metrics, or stakeholders.",
    "- If the learner's action matches a reveal_condition trigger, list those hidden_fact ids in revealed_fact_ids.",
    "- Do NOT reveal true_interest unless a matching reveal_condition was triggered.",
    "- state_changed = true only when the learner's action meaningfully changes world state (e.g., receives new information, advances the scenario).",
    "- Keep narration in character. Do not coach, evaluate, or score the learner.",
    "- Maximum narration length: 400 words.",
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
