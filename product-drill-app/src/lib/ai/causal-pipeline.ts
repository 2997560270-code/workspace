import { zodTextFormat } from "openai/helpers/zod";
import { captureServerException } from "../monitoring/server";
import { runtimeEnv } from "../env";
import { getOpenAIClient } from "./client";
import {
  BehaviorObservationSchema,
  HypothesisUpdateSchema,
  WorldNarratorOutputSchema,
} from "./causal-schemas";
import {
  buildBehaviorObserverPrompt,
  buildHypothesisUpdaterPrompt,
  buildWorldNarratorPrompt,
} from "./causal-prompts";
import type {
  CausalWorldVersion,
  DecisionEvent,
  WorldEvent,
} from "../causal-world";
import { z } from "zod";
import {
  DISCOVERY_DIMENSIONS,
  REQUIRED_FORBIDDEN_INFERENCES,
  type DiscoveryDimension,
} from "../behavior-claims";

export type WorldNarration = z.infer<typeof WorldNarratorOutputSchema> & {
  unofficial: boolean;
  model_version: string;
};

export type BehaviorObservation = z.infer<typeof BehaviorObservationSchema> & {
  model_version: string;
};

export type HypothesisUpdate = z.infer<typeof HypothesisUpdateSchema> & {
  model_version: string;
};

const INSUFFICIENT_EVIDENCE_REASON =
  "证据不足：决策依据未覆盖至少两个可追溯的发现维度，无法输出行为结论。";

function getGovernedEvidenceById(
  decisionEvent: DecisionEvent,
  eventHistory: WorldEvent[]
): Map<string, { event: WorldEvent; dimension: DiscoveryDimension }> {
  const selectedIds = new Set(decisionEvent.evidence_basis);
  return new Map(
    eventHistory.flatMap((event) => {
      const dimension = event.payload.discovery_dimension;
      if (
        !selectedIds.has(event.id) ||
        event.actor !== "user" ||
        !DISCOVERY_DIMENSIONS.includes(dimension as DiscoveryDimension)
      ) {
        return [];
      }
      return [[event.id, { event, dimension: dimension as DiscoveryDimension }]];
    })
  );
}

function canonicalHypothesisDirection(
  observation: BehaviorObservation
): HypothesisUpdate["update_direction"] {
  if (observation.confidence === "low") return "insufficient";
  return observation.missing_dimensions.length > 0 ? "supports" : "contradicts";
}

function canonicalUpdatedConfidence(
  direction: HypothesisUpdate["update_direction"]
): HypothesisUpdate["updated_confidence"] {
  if (direction === "insufficient" || direction === "neutral") return "insufficient";
  return direction === "supports" ? "medium" : "low";
}

function canonicalHypothesisRationale(
  direction: HypothesisUpdate["update_direction"],
  observation: BehaviorObservation
): string {
  if (direction === "insufficient") {
    return observation.insufficient_reason ?? INSUFFICIENT_EVIDENCE_REASON;
  }
  if (direction === "supports") {
    return `可追溯证据仍缺少 ${observation.missing_dimensions.join(", ")} 维度，支持过早承诺假设。`;
  }
  return "可追溯证据覆盖 workflow、consequence 和 alternative 三个维度，反驳本次过早承诺假设。";
}

// ── 确定性降级：World Narrator ────────────────────────────────────
function deterministicNarration(
  worldVersion: CausalWorldVersion,
  userAction: string,
  revealedFactIds: string[]
): WorldNarration {
  // 检查是否匹配任何揭示条件
  const newReveals: string[] = [];
  for (const cond of worldVersion.immutable_rules.reveal_conditions) {
    // Fix: empty-string trigger must not match every user action
    if (cond.trigger === "*" || (cond.trigger.length > 0 && userAction.includes(cond.trigger))) {
      newReveals.push(...cond.reveals);
    }
  }
  const allRevealed = [...new Set([...revealedFactIds, ...newReveals])];
  const revealedFacts = worldVersion.immutable_rules.hidden_facts.filter((f) =>
    allRevealed.includes(f.id)
  );

  const narration =
    revealedFacts.length > 0
      ? `[确定性演示模式] 角色回应中。本轮揭示信息：${revealedFacts.map((f) => f.content).join("；")}`
      : `[确定性演示模式] 角色收到了你的问题，但需要更具体的信息才能回应。`;

  return {
    narration,
    revealed_fact_ids: newReveals,
    state_changed: newReveals.length > 0,
    state_change_summary: newReveals.length > 0 ? "揭示了新信息" : null,
    unofficial: true,
    model_version: "deterministic-v1",
  };
}

// ── 确定性降级：Behavior Observer ────────────────────────────────
function deterministicBehaviorObservation(
  decisionEvent: DecisionEvent,
  eventHistory: WorldEvent[],
  wasAssisted: boolean  // Fix: accept wasAssisted so fallback honours hint status
): BehaviorObservation {
  const governedEvidence = getGovernedEvidenceById(decisionEvent, eventHistory);
  const structuredEvidence = [...governedEvidence.entries()].map(
    ([eventId, { event, dimension }]) => ({ event, eventId, dimension })
  );
  const coveredDimensions = new Set(structuredEvidence.map((item) => item.dimension));
  const missingDimensions = DISCOVERY_DIMENSIONS.filter((dimension) => !coveredDimensions.has(dimension));
  const hasMinimumEvidence = coveredDimensions.size >= 2;

  return {
    observations: hasMinimumEvidence
      ? structuredEvidence.map(({ event, eventId, dimension }) => ({
          behavior_code: `DISCOVERY_${dimension.toUpperCase()}`,
          description: `[确定性演示] 决策引用了结构化的 ${dimension} 调查事件。`,
          evidence_event_ids: [eventId],
          evidence_quotes:
            typeof event.payload.text === "string" ? [event.payload.text] : [],
          dimension_covered: dimension,
        }))
      : [],
    missing_dimensions: missingDimensions,
    assisted: wasAssisted,
    confidence: hasMinimumEvidence ? "medium" : "low",
    insufficient_reason: hasMinimumEvidence
      ? null
      : INSUFFICIENT_EVIDENCE_REASON,
    model_version: "deterministic-v1",
  };
}

// ── 确定性降级：Hypothesis Updater ───────────────────────────────
function deterministicHypothesisUpdate(
  habitName: string,
  observation: BehaviorObservation
): HypothesisUpdate {
  const direction = canonicalHypothesisDirection(observation);

  return {
    habit_name: habitName,
    update_direction: direction,
    // The governed direction determines the stored confidence envelope.
    updated_confidence: canonicalUpdatedConfidence(direction),
    rationale: canonicalHypothesisRationale(direction, observation),
    referenced_evidence_ids: observation.observations.flatMap((o) => o.evidence_event_ids),
    applicable_trigger_conditions: [],
    forbidden_inferences_confirmed: [...REQUIRED_FORBIDDEN_INFERENCES],
    model_version: "deterministic-v1",
  };
}

// ── World Narrator ────────────────────────────────────────────────
export async function narrateWorldResponse(params: {
  worldVersion: CausalWorldVersion;
  userAction: string;
  eventHistory: WorldEvent[];
  revealedFactIds: string[];
}): Promise<WorldNarration> {
  const client = getOpenAIClient();
  // Fix: !isOpenAIConfigured() is dead code — getOpenAIClient() returns null
  // when not configured, so !client already covers that case.
  if (!client) {
    return deterministicNarration(
      params.worldVersion,
      params.userAction,
      params.revealedFactIds
    );
  }

  try {
    const response = await client.responses.parse({
      model: runtimeEnv.roleplayModel,
      input: buildWorldNarratorPrompt(params),
      text: {
        format: zodTextFormat(WorldNarratorOutputSchema, "world_narration"),
      },
    });
    const parsed = response.output_parsed;
    if (!parsed) throw new Error("World narrator response was not parsed");

    // 校验：揭示的 fact id 必须存在于 immutable_rules
    const validFactIds = new Set(
      params.worldVersion.immutable_rules.hidden_facts.map((f) => f.id)
    );
    const safeRevealedIds = parsed.revealed_fact_ids.filter((id) => validFactIds.has(id));

    // Fix: if all AI-supplied fact IDs were hallucinated and filtered out,
    // state_changed must be false — a contradictory envelope (changed=true,
    // reveals=[]) would corrupt the caller's revealed-facts accumulator.
    const stateChanged = safeRevealedIds.length > 0 ? parsed.state_changed : false;
    const stateChangeSummary = stateChanged ? parsed.state_change_summary : null;

    return {
      narration: parsed.narration,
      revealed_fact_ids: safeRevealedIds,
      state_changed: stateChanged,
      state_change_summary: stateChangeSummary,
      unofficial: false,
      model_version: `${runtimeEnv.roleplayModel}:${runtimeEnv.modelVersion}`,
    };
  } catch (error) {
    captureServerException(error, { area: "world_narrator" });
    return deterministicNarration(
      params.worldVersion,
      params.userAction,
      params.revealedFactIds
    );
  }
}

// ── Behavior Observer ─────────────────────────────────────────────
export async function observeBehavior(params: {
  worldVersion: CausalWorldVersion;
  decisionEvent: DecisionEvent;
  eventHistory: WorldEvent[];
  wasAssisted: boolean;
}): Promise<BehaviorObservation> {
  const client = getOpenAIClient();
  if (!client) {
    // Fix: pass wasAssisted so the fallback records hint status correctly
    return deterministicBehaviorObservation(
      params.decisionEvent,
      params.eventHistory,
      params.wasAssisted
    );
  }

  try {
    const response = await client.responses.parse({
      model: runtimeEnv.evaluationModel,
      input: buildBehaviorObserverPrompt({
        worldVersion: params.worldVersion,
        decisionEvent: params.decisionEvent,
        eventHistory: params.eventHistory,
        behaviorAnchors: params.worldVersion.behavior_anchors,
        wasAssisted: params.wasAssisted,
      }),
      text: {
        format: zodTextFormat(BehaviorObservationSchema, "behavior_observation"),
      },
    });
    const parsed = response.output_parsed;
    if (!parsed) throw new Error("Behavior observer response was not parsed");

    // Only user-selected, structured investigation events are authoritative.
    // The model cannot promote an unrelated event into evidence or relabel its
    // discovery dimension.
    const governedEvidence = getGovernedEvidenceById(
      params.decisionEvent,
      params.eventHistory
    );
    const safeObservations = parsed.observations
      .map((obs) => {
        const evidenceEventIds = obs.evidence_event_ids.filter((id) =>
          governedEvidence.has(id)
        );
        const governedDimension = evidenceEventIds
          .map((id) => governedEvidence.get(id)?.dimension)
          .find((dimension): dimension is DiscoveryDimension => Boolean(dimension));
        const dimensionEventIds = governedDimension
          ? evidenceEventIds.filter(
              (id) => governedEvidence.get(id)?.dimension === governedDimension
            )
          : [];
        const sourceTexts = dimensionEventIds.flatMap((id) => {
          const text = governedEvidence.get(id)?.event.payload.text;
          return typeof text === "string" ? [text] : [];
        });
        const evidenceQuotes = obs.evidence_quotes.filter(
          (quote) => quote.length > 0 && sourceTexts.some((source) => source.includes(quote))
        );
        const dimensionCovered: DiscoveryDimension | "none" = governedDimension ?? "none";
        return {
          ...obs,
          evidence_event_ids: dimensionEventIds,
          evidence_quotes: evidenceQuotes,
          dimension_covered: dimensionCovered,
        };
      })
      .filter(
        (obs) => obs.evidence_event_ids.length > 0 && obs.evidence_quotes.length > 0
      );

    const coveredDimensions = new Set(
      safeObservations.flatMap((obs) =>
        obs.dimension_covered === "none" ? [] : [obs.dimension_covered]
      )
    );
    const missingDimensions = DISCOVERY_DIMENSIONS.filter(
      (dimension) => !coveredDimensions.has(dimension)
    );
    const hasMinimumEvidence = coveredDimensions.size >= 2;

    return {
      ...parsed,
      observations: hasMinimumEvidence ? safeObservations : [],
      missing_dimensions: missingDimensions,
      // Fix (CRITICAL): always override assisted with the authoritative
      // params.wasAssisted flag — the AI-returned value must never win,
      // because the hint-used state is system-tracked, not model-inferred.
      assisted: params.wasAssisted,
      confidence: hasMinimumEvidence ? "medium" : "low",
      insufficient_reason: hasMinimumEvidence ? null : INSUFFICIENT_EVIDENCE_REASON,
      model_version: `${runtimeEnv.evaluationModel}:${runtimeEnv.modelVersion}`,
    };
  } catch (error) {
    captureServerException(error, { area: "behavior_observer" });
    // Fix: pass wasAssisted to the fallback on error path as well
    return deterministicBehaviorObservation(
      params.decisionEvent,
      params.eventHistory,
      params.wasAssisted
    );
  }
}

// ── Hypothesis Updater ────────────────────────────────────────────
export async function updateHypothesis(params: {
  habitName: string;
  currentConfidence: string;
  currentTriggerConditions: string[];
  behaviorObservation: BehaviorObservation;
  worldId: string;
  worldVersion: string;
  isTransferWorld: boolean;
}): Promise<HypothesisUpdate> {
  const client = getOpenAIClient();
  if (!client) {
    return deterministicHypothesisUpdate(
      params.habitName,
      params.behaviorObservation
    );
  }

  try {
    const response = await client.responses.parse({
      model: runtimeEnv.evaluationModel,
      input: buildHypothesisUpdaterPrompt(params),
      text: {
        format: zodTextFormat(HypothesisUpdateSchema, "hypothesis_update"),
      },
    });
    const parsed = response.output_parsed;
    if (!parsed) throw new Error("Hypothesis updater response was not parsed");

    // 安全校验：referenced_evidence_ids 只能来自 observation
    const validObsIds = new Set(
      params.behaviorObservation.observations.flatMap((o) => o.evidence_event_ids)
    );
    // Direction and confidence are evidence-derived invariants. A model can
    // explain the result, but cannot reverse it or upgrade insufficient data.
    const direction = canonicalHypothesisDirection(params.behaviorObservation);

    // 确保禁止推断项被声明
    const forbiddenInferences = new Set(parsed.forbidden_inferences_confirmed);
    for (const required of REQUIRED_FORBIDDEN_INFERENCES) {
      forbiddenInferences.add(required);
    }

    return {
      ...parsed,
      habit_name: params.habitName,
      update_direction: direction,
      updated_confidence: canonicalUpdatedConfidence(direction),
      rationale: canonicalHypothesisRationale(direction, params.behaviorObservation),
      referenced_evidence_ids:
        direction === "insufficient" ? [] : [...validObsIds],
      forbidden_inferences_confirmed: [...forbiddenInferences],
      model_version: `${runtimeEnv.evaluationModel}:${runtimeEnv.modelVersion}`,
    };
  } catch (error) {
    captureServerException(error, { area: "hypothesis_updater" });
    return deterministicHypothesisUpdate(
      params.habitName,
      params.behaviorObservation
    );
  }
}
