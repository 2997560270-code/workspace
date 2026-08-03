import { observeBehavior, updateHypothesis, type BehaviorObservation, type HypothesisUpdate } from "./ai/causal-pipeline";
import { PREMATURE_SOLUTION_COMMITMENT_CLAIM } from "./behavior-claims";
import {
  createHypothesisEvidence,
  createJudgmentHypothesis,
  type HypothesisEvidence,
  type JudgmentHypothesis,
} from "./causal-world";
import { classifyInterventionTiming } from "./intervention-generator";
import {
  completeChallengeRun,
  getChallengeDecisionRecords,
  getChallengeRun,
  getDecisionEvent,
  getInterventionsForRun,
  getJudgmentProfile,
  getWorldEventsForRun,
  RunNotFoundError,
  upsertHypothesisEvidence,
  upsertJudgmentHypothesis,
} from "./repositories/challenge-repository";
import { judgeTransferEvidence } from "./transfer-judge";
import { DEMO_WORLDS, getDemoWorld } from "./world-seeds";

export type ChallengeEvaluationResult = {
  observation: BehaviorObservation;
  update: HypothesisUpdate;
  hypothesis: JudgmentHypothesis;
  evidence: HypothesisEvidence | null;
};

function appendUnique(values: string[], value: string): string[] {
  return values.includes(value) ? values : [...values, value];
}

function canCreateEvidence(observation: BehaviorObservation, update: HypothesisUpdate): boolean {
  return (
    observation.confidence !== "low" &&
    observation.observations.length > 0 &&
    update.referenced_evidence_ids.length > 0 &&
    (update.update_direction === "supports" || update.update_direction === "contradicts")
  );
}

export async function evaluateChallengeDecision(params: {
  userId: string;
  runId: string;
  decisionEventId: string;
}): Promise<ChallengeEvaluationResult> {
  const run = await getChallengeRun(params.userId, params.runId);
  if (!run) throw new RunNotFoundError();

  const world = getDemoWorld(run.world_id);
  if (!world || world.version.version !== run.world_version) {
    throw new Error(`Governed world version not found: ${run.world_id}@${run.world_version}`);
  }

  const [decision, eventHistory, interventions, hypotheses, completedRecords] = await Promise.all([
    getDecisionEvent(params.userId, params.runId, params.decisionEventId),
    getWorldEventsForRun(params.userId, params.runId),
    getInterventionsForRun(params.userId, params.runId),
    getJudgmentProfile(params.userId),
    getChallengeDecisionRecords(params.userId),
  ]);
  if (!decision) throw new RunNotFoundError();

  const timing = classifyInterventionTiming(interventions, decision);
  const habitName = world.version.target_habit;
  const current = hypotheses.find((hypothesis) => hypothesis.habit_name === habitName);
  let hypothesis = current ?? createJudgmentHypothesis({
    id: `hyp-${params.userId}-${habitName}`,
    userId: params.userId,
    habitName,
  });

  const observation = await observeBehavior({
    worldVersion: world.version,
    decisionEvent: decision,
    eventHistory,
    wasAssisted: timing.was_assisted,
  });
  const update = await updateHypothesis({
    habitName,
    currentConfidence: hypothesis.confidence,
    currentTriggerConditions: hypothesis.trigger_conditions,
    behaviorObservation: observation,
    worldId: world.world_id,
    worldVersion: world.version.version,
    isTransferWorld: world.transfer_role === "transfer_test",
  });

  if (!current) {
    hypothesis = await upsertJudgmentHypothesis(hypothesis);
  }

  let evidence: HypothesisEvidence | null = null;
  if (canCreateEvidence(observation, update)) {
    const baseType = timing.was_assisted
      ? "assisted"
      : update.update_direction === "supports"
        ? "supporting"
        : "counter";
    evidence = createHypothesisEvidence({
      evidenceId: `hyp-ev-${decision.id}`,
      hypothesisId: hypothesis.id,
      decisionEventId: decision.id,
      evidenceType: baseType,
      worldId: world.world_id,
      worldVersion: world.version.version,
      modelVersion: update.model_version,
    });

    const trainingWorldIds = DEMO_WORLDS
      .filter((candidate) => candidate.transfer_role !== "transfer_test")
      .map((candidate) => candidate.world_id);
    const completedWorldIds = new Set(
      completedRecords.map(({ run: completedRun }) => completedRun.world_id)
    );
    const completedTrainingSequence = trainingWorldIds.every((worldId) =>
      completedWorldIds.has(worldId)
    );

    if (
      world.transfer_role === "transfer_test" &&
      baseType === "counter" &&
      completedTrainingSequence
    ) {
      evidence = judgeTransferEvidence({
        training_world_ids: trainingWorldIds,
        transfer_world_id: world.world_id,
        decision_run_id: run.id,
        evidence,
        interventions_in_run: interventions,
        observation_confidence: observation.confidence,
      }).updated_evidence;
    }

    await upsertHypothesisEvidence(evidence);
  }

  const nextConfidence = evidence && !timing.was_assisted
    ? update.updated_confidence
    : hypothesis.confidence;
  const nextTriggers = evidence && update.applicable_trigger_conditions.length > 0
    ? update.applicable_trigger_conditions
    : hypothesis.trigger_conditions;
  hypothesis = {
    ...hypothesis,
    confidence: nextConfidence,
    trigger_conditions: nextTriggers,
    supporting_evidence_ids:
      evidence && update.update_direction === "supports" && evidence.evidence_type !== "assisted"
        ? appendUnique(hypothesis.supporting_evidence_ids, evidence.id)
        : hypothesis.supporting_evidence_ids,
    counter_evidence_ids:
      evidence && update.update_direction === "contradicts" && evidence.evidence_type !== "assisted"
        ? appendUnique(hypothesis.counter_evidence_ids, evidence.id)
        : hypothesis.counter_evidence_ids,
    last_updated_at: new Date().toISOString(),
  };
  hypothesis = await upsertJudgmentHypothesis(hypothesis);
  await completeChallengeRun(params.userId, params.runId);

  return { observation, update, hypothesis, evidence };
}
