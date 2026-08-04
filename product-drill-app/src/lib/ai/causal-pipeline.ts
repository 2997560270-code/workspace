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
  // 简单判断：evidence_basis 是否引用了真实 event id
  const validIds = new Set(eventHistory.map((e) => e.id));
  const validBasis = decisionEvent.evidence_basis.filter((id) => validIds.has(id));

  const eventsById = new Map(eventHistory.map((event) => [event.id, event]));
  const structuredEvidence = validBasis.flatMap((eventId) => {
    const event = eventsById.get(eventId);
    if (!event) return [];
    const dimension = event.payload.discovery_dimension;
    if (!DISCOVERY_DIMENSIONS.includes(dimension as DiscoveryDimension)) return [];
    return [{ event, eventId, dimension: dimension as DiscoveryDimension }];
  });
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
      : "[确定性演示] 缺少至少两个结构化发现维度，无法输出能力结论。",
    model_version: "deterministic-v1",
  };
}

// ── 确定性降级：Hypothesis Updater ───────────────────────────────
function deterministicHypothesisUpdate(
  habitName: string,
  observation: BehaviorObservation
): HypothesisUpdate {
  const direction =
    observation.confidence === "low"
      ? "insufficient"
      : observation.missing_dimensions.length > 0
      ? "supports"
      : "contradicts";

  return {
    habit_name: habitName,
    update_direction: direction,
    // Fix (HIGH): confidence must reflect the direction, not be hardcoded 'low'.
    // contradicts (all dims covered, medium obs confidence) → 'medium'
    // supports (some dims missing, medium obs confidence) → 'low'
    // insufficient → 'insufficient'
    updated_confidence:
      direction === "insufficient"
        ? "insufficient"
        : direction === "supports"
        // Fix (CRITICAL): 'supports' = bad habit confirmed → confidence rises
        ? "medium"
        // Fix (CRITICAL): 'contradicts' = good behavior → confidence falls
        : "low",
    rationale: "[确定性演示] 基于行为观察的简单推断，不用于正式评估。",
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

    // 安全校验：evidence_event_ids 只能引用真实 event id
    const validIds = new Set(params.eventHistory.map((e) => e.id));
    // Fix: drop entire observation when all its IDs are hallucinated, rather
    // than keeping it with an empty array that bypasses the min(1) contract.
    const eventsById = new Map(params.eventHistory.map((event) => [event.id, event]));
    const safeObservations = parsed.observations
      .map((obs) => {
        const evidenceEventIds = obs.evidence_event_ids.filter((id) => validIds.has(id));
        const sourceTexts = evidenceEventIds.flatMap((id) => {
          const text = eventsById.get(id)?.payload.text;
          return typeof text === "string" ? [text] : [];
        });
        return {
          ...obs,
          evidence_event_ids: evidenceEventIds,
          evidence_quotes: obs.evidence_quotes.filter((quote) =>
            sourceTexts.some((source) => source.includes(quote))
          ),
        };
      })
      .filter((obs) => obs.evidence_event_ids.length > 0);

    // 若校验后无任何有效证据，降为 low confidence
    const hasValidEvidence = safeObservations.length > 0;
    const confidence =
      !hasValidEvidence && parsed.confidence !== "low" ? "low" : parsed.confidence;
    const insufficientReason =
      !hasValidEvidence
        ? "AI returned evidence IDs that do not correspond to real events; downgraded to insufficient."
        : parsed.insufficient_reason;

    return {
      ...parsed,
      observations: safeObservations,
      // Fix (CRITICAL): always override assisted with the authoritative
      // params.wasAssisted flag — the AI-returned value must never win,
      // because the hint-used state is system-tracked, not model-inferred.
      assisted: params.wasAssisted,
      confidence,
      insufficient_reason: insufficientReason,
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
    const safeRefIds = parsed.referenced_evidence_ids.filter((id) =>
      validObsIds.has(id)
    );

    // 确保禁止推断项被声明
    const forbiddenInferences = new Set(parsed.forbidden_inferences_confirmed);
    for (const required of REQUIRED_FORBIDDEN_INFERENCES) {
      forbiddenInferences.add(required);
    }

    return {
      ...parsed,
      referenced_evidence_ids: safeRefIds,
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
