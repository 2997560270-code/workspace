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
  getNarratorAllowedFacts,
} from "./causal-prompts";
import type {
  CausalWorldVersion,
  DecisionEvent,
  WorldEvent,
} from "../causal-world";
import {
  getInvestigationSuggestion,
  getMatchedRevealFactIds,
  getRelevantInformationGapReply,
  isWorldRelevantAction,
} from "../causal-world";
import { z } from "zod";
import {
  DISCOVERY_DIMENSIONS,
  REQUIRED_FORBIDDEN_INFERENCES,
  type DiscoveryDimension,
} from "../behavior-claims";
import {
  requestStructuredResponse,
  StructuredResponseError,
  type StructuredResponseFailureReason,
} from "./structured-response";

export type CausalFallbackReason =
  | "model_not_configured"
  | "request_failed"
  | "response_parse_failed"
  | "schema_validation_failed"
  | "grounding_validation_failed";

export type WorldNarration = z.infer<typeof WorldNarratorOutputSchema> & {
  revealed_fact_ids: string[];
  state_changed: boolean;
  state_change_summary: string | null;
  unofficial: boolean;
  model_version: string;
  fallback_reason: CausalFallbackReason | null;
};

export type BehaviorObservation = z.infer<typeof BehaviorObservationSchema> & {
  model_version: string;
  fallback_reason: CausalFallbackReason | null;
};

export type HypothesisUpdate = z.infer<typeof HypothesisUpdateSchema> & {
  model_version: string;
  fallback_reason: CausalFallbackReason | null;
};

function getFallbackReason(error: unknown): CausalFallbackReason {
  if (error instanceof StructuredResponseError) {
    const reason: StructuredResponseFailureReason = error.reason;
    if (reason === "schema_validation_failed") return reason;
    if (reason === "response_parse_failed") return reason;
    return "request_failed";
  }
  if (error instanceof Error && /grounding|fact|narrator/i.test(error.message)) {
    return "grounding_validation_failed";
  }
  return "request_failed";
}

const INSUFFICIENT_EVIDENCE_REASON =
  "证据不足：决策依据未覆盖至少两个可追溯的发现维度，无法输出行为结论。";
const AMBIGUOUS_ACTIONS = new Set([
  "ok",
  "okay",
  "yes",
  "no",
  "好",
  "好的",
  "继续",
  "下一步",
]);

export function isAmbiguousLearnerAction(userAction: string): boolean {
  const normalized = userAction.trim().toLowerCase().replace(/\s+/g, "");
  return (
    normalized.length === 0 ||
    !/[a-z\u3400-\u9fff]/i.test(normalized) ||
    AMBIGUOUS_ACTIONS.has(normalized)
  );
}

function getNewRevealedFactIds(
  worldVersion: CausalWorldVersion,
  userAction: string,
  revealedFactIds: string[]
): string[] {
  const alreadyRevealed = new Set(revealedFactIds);
  return getMatchedRevealFactIds(worldVersion, userAction).filter(
    (id) => !alreadyRevealed.has(id)
  );
}

function governedClarification(): WorldNarration {
  return {
    response_type: "clarification",
    narration: "你的输入还不够明确。请说明你想调查的信息，或明确准备采取的行动。",
    cited_fact_ids: [],
    revealed_fact_ids: [],
    state_changed: false,
    state_change_summary: null,
    unofficial: false,
    model_version: "governed-clarifier-v1",
    fallback_reason: null,
  };
}

function isConciseNarration(narration: string): boolean {
  const sentenceCount = narration.match(/[。！？!?]/g)?.length ?? 1;
  return Array.from(narration).length <= 220 && sentenceCount <= 5;
}

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
  revealedFactIds: string[],
  fallbackReason: CausalFallbackReason = "model_not_configured"
): WorldNarration {
  const matchedFactIds = getMatchedRevealFactIds(worldVersion, userAction);
  const newReveals = getNewRevealedFactIds(
    worldVersion,
    userAction,
    revealedFactIds
  );
  const revealedFacts = worldVersion.immutable_rules.hidden_facts.filter((f) =>
    matchedFactIds.includes(f.id)
  );

  const narration =
    revealedFacts.length > 0
      ? revealedFacts.map((f) => f.content).join("；")
      : isWorldRelevantAction(worldVersion, userAction)
        ? getRelevantInformationGapReply(worldVersion, userAction)
        : getInvestigationSuggestion(worldVersion);
  const responseType =
    revealedFacts.length > 0 || isWorldRelevantAction(worldVersion, userAction)
      ? "role_reply"
      : "clarification";

  return {
    response_type: responseType,
    narration,
    cited_fact_ids: matchedFactIds,
    revealed_fact_ids: newReveals,
    state_changed: newReveals.length > 0,
    state_change_summary: newReveals.length > 0 ? "揭示了新信息" : null,
    unofficial: true,
    model_version: "deterministic-v1",
    fallback_reason: fallbackReason,
  };
}

// ── 确定性降级：Behavior Observer ────────────────────────────────
function deterministicBehaviorObservation(
  decisionEvent: DecisionEvent,
  eventHistory: WorldEvent[],
  wasAssisted: boolean, // Fix: accept wasAssisted so fallback honours hint status
  fallbackReason: CausalFallbackReason = "model_not_configured"
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
    fallback_reason: fallbackReason,
  };
}

// ── 确定性降级：Hypothesis Updater ───────────────────────────────
function deterministicHypothesisUpdate(
  habitName: string,
  observation: BehaviorObservation,
  fallbackReason: CausalFallbackReason = "model_not_configured"
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
    fallback_reason: fallbackReason,
  };
}

// ── World Narrator ────────────────────────────────────────────────
export async function narrateWorldResponse(params: {
  worldVersion: CausalWorldVersion;
  userAction: string;
  eventHistory: WorldEvent[];
  revealedFactIds: string[];
}): Promise<WorldNarration> {
  if (isAmbiguousLearnerAction(params.userAction)) {
    return governedClarification();
  }

  const client = getOpenAIClient();
  // Fix: !isOpenAIConfigured() is dead code — getOpenAIClient() returns null
  // when not configured, so !client already covers that case.
  if (!client) {
    return deterministicNarration(
      params.worldVersion,
      params.userAction,
      params.revealedFactIds,
      "model_not_configured"
    );
  }

  // Reveal state is derived by the server before the model sees the prompt.
  // The model may cite facts, but it cannot decide which facts become true.
  const newlyRevealedIds = getNewRevealedFactIds(
    params.worldVersion,
    params.userAction,
    params.revealedFactIds
  );
  const allRevealedIds = [
    ...new Set([...params.revealedFactIds, ...newlyRevealedIds]),
  ];

  try {
    const parsed = await requestStructuredResponse({
      client,
      model: runtimeEnv.roleplayModel,
      input: buildWorldNarratorPrompt({
        ...params,
        revealedFactIds: allRevealedIds,
      }),
      schema: WorldNarratorOutputSchema,
      schemaName: "world_narration",
    });

    const allowedFactIds = new Set(
      getNarratorAllowedFacts(params.worldVersion, allRevealedIds).map(
        (fact) => fact.id
      )
    );
    const citedFactIds = [...new Set(parsed.cited_fact_ids)];
    const locallyRelevant = isWorldRelevantAction(
      params.worldVersion,
      params.userAction
    );
    const incorrectlyRejectsRelevantInput =
      locallyRelevant &&
      parsed.response_type === "clarification" &&
      /无关|没有直接关系|偏离|回到当前/.test(parsed.narration);
    if (incorrectlyRejectsRelevantInput) {
      throw new Error("World narrator incorrectly rejected a relevant input");
    }
    const resolvedResponseType = locallyRelevant
      ? "role_reply"
      : parsed.response_type;
    const resolvedCitedFactIds =
      locallyRelevant && citedFactIds.length === 0
        ? ["scenario-trigger"]
        : citedFactIds;
    const validRoleReply =
      resolvedResponseType === "role_reply" && resolvedCitedFactIds.length > 0;
    const validClarification =
      resolvedResponseType === "clarification" &&
      resolvedCitedFactIds.length === 0 &&
      !locallyRelevant;

    if (
      (!validRoleReply && !validClarification) ||
      resolvedCitedFactIds.some((id) => !allowedFactIds.has(id)) ||
      !isConciseNarration(parsed.narration)
    ) {
      throw new Error("World narrator response violated grounding or brevity rules");
    }

    return {
      response_type: resolvedResponseType,
      narration: parsed.narration,
      cited_fact_ids: resolvedCitedFactIds,
      revealed_fact_ids: validRoleReply ? newlyRevealedIds : [],
      state_changed: validRoleReply && newlyRevealedIds.length > 0,
      state_change_summary:
        validRoleReply && newlyRevealedIds.length > 0
          ? "揭示了受治理的新信息"
          : null,
      unofficial: false,
      model_version: `${runtimeEnv.roleplayModel}:${runtimeEnv.modelVersion}`,
      fallback_reason: null,
    };
  } catch (error) {
    captureServerException(error, { area: "world_narrator" });
    return deterministicNarration(
      params.worldVersion,
      params.userAction,
      params.revealedFactIds,
      getFallbackReason(error)
    );
  }
}

// ── Behavior Observer ─────────────────────────────────────────────
export async function observeBehavior(params: {
  worldVersion: CausalWorldVersion;
  decisionEvent: DecisionEvent;
  eventHistory: WorldEvent[];
  wasAssisted: boolean;
  signal?: AbortSignal;
}): Promise<BehaviorObservation> {
  const client = getOpenAIClient();
  if (!client) {
    // Fix: pass wasAssisted so the fallback records hint status correctly
    return deterministicBehaviorObservation(
      params.decisionEvent,
      params.eventHistory,
      params.wasAssisted,
      "model_not_configured"
    );
  }

  try {
    const parsed = await requestStructuredResponse({
      client,
      model: runtimeEnv.evaluationModel,
      input: buildBehaviorObserverPrompt({
        worldVersion: params.worldVersion,
        decisionEvent: params.decisionEvent,
        eventHistory: params.eventHistory,
        behaviorAnchors: params.worldVersion.behavior_anchors,
        wasAssisted: params.wasAssisted,
      }),
      schema: BehaviorObservationSchema,
      schemaName: "behavior_observation",
      signal: params.signal,
    });

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

    // Coverage is a governed fact derived from selected structured events.
    // The model may explain those events, but cannot omit or relabel them.
    const authoritativeObservation = deterministicBehaviorObservation(
      params.decisionEvent,
      params.eventHistory,
      params.wasAssisted
    );
    const modelObservationByDimension = new Map(
      safeObservations.flatMap((observation) =>
        observation.dimension_covered === "none"
          ? []
          : [[observation.dimension_covered, observation] as const]
      )
    );
    const authoritativeObservations = authoritativeObservation.observations.map(
      (observation) =>
        observation.dimension_covered === "none"
          ? observation
          : modelObservationByDimension.get(observation.dimension_covered) ?? observation
    );
    const coveredDimensions = new Set(
      [...governedEvidence.values()].map(({ dimension }) => dimension)
    );
    const missingDimensions = DISCOVERY_DIMENSIONS.filter(
      (dimension) => !coveredDimensions.has(dimension)
    );
    const hasMinimumEvidence = coveredDimensions.size >= 2;

    return {
      ...parsed,
      observations: hasMinimumEvidence ? authoritativeObservations : [],
      missing_dimensions: missingDimensions,
      // Fix (CRITICAL): always override assisted with the authoritative
      // params.wasAssisted flag — the AI-returned value must never win,
      // because the hint-used state is system-tracked, not model-inferred.
      assisted: params.wasAssisted,
      confidence: hasMinimumEvidence ? "medium" : "low",
      insufficient_reason: hasMinimumEvidence ? null : INSUFFICIENT_EVIDENCE_REASON,
      model_version: `${runtimeEnv.evaluationModel}:${runtimeEnv.modelVersion}`,
      fallback_reason: null,
    };
  } catch (error) {
    captureServerException(error, { area: "behavior_observer" });
    // Fix: pass wasAssisted to the fallback on error path as well
    return deterministicBehaviorObservation(
      params.decisionEvent,
      params.eventHistory,
      params.wasAssisted,
      getFallbackReason(error)
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
  signal?: AbortSignal;
}): Promise<HypothesisUpdate> {
  const client = getOpenAIClient();
  if (!client) {
    return deterministicHypothesisUpdate(
      params.habitName,
      params.behaviorObservation,
      "model_not_configured"
    );
  }

  try {
    const parsed = await requestStructuredResponse({
      client,
      model: runtimeEnv.evaluationModel,
      input: buildHypothesisUpdaterPrompt(params),
      schema: HypothesisUpdateSchema,
      schemaName: "hypothesis_update",
      signal: params.signal,
    });

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
      fallback_reason: null,
    };
  } catch (error) {
    captureServerException(error, { area: "hypothesis_updater" });
    return deterministicHypothesisUpdate(
      params.habitName,
      params.behaviorObservation,
      getFallbackReason(error)
    );
  }
}
