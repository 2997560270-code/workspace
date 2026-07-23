import { createSupabaseAdminClient } from "../supabase/admin";
import {
  createChallengeRun,
  createDecisionEvent,
  createHypothesisEvidence,
  createIntervention,
  createWorldEvent,
  type ChallengeRun,
  type DecisionEvent,
  type HypothesisEvidence,
  type Intervention,
  type JudgmentHypothesis,
  type WorldEvent,
} from "../causal-world";
import { isEvidenceTraceable } from "../causal-world";

// ── challenge runs ────────────────────────────────────────────────
export async function insertChallengeRun(
  userId: string,
  worldId: string,
  worldVersion: string,
  modelVersion: string
): Promise<ChallengeRun> {
  const run = createChallengeRun({ userId, worldId, worldVersion, modelVersion });
  const admin = createSupabaseAdminClient();
  if (!admin) return run; // demo mode: in-memory only
  const { error } = await admin.from("challenge_runs").insert({
    id: run.id,
    user_id: run.user_id,
    world_id: run.world_id,
    world_version: run.world_version,
    model_version: run.model_version,
    status: run.status,
    started_at: run.started_at,
    completed_at: run.completed_at,
  });
  if (error) throw error;
  return run;
}

export async function getChallengeRun(
  userId: string,
  runId: string
): Promise<ChallengeRun | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const { data, error } = await admin
    .from("challenge_runs")
    .select("*")
    .eq("id", runId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as ChallengeRun | null;
}

export async function completeChallengeRun(
  userId: string,
  runId: string
): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  const { error } = await admin
    .from("challenge_runs")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", runId)
    .eq("user_id", userId)
    .eq("status", "active"); // 只允许从 active 转为 completed
  if (error) throw error;
}

// ── world events ──────────────────────────────────────────────────
export async function appendWorldEvent(params: {
  runId: string;
  userId: string;
  eventType: WorldEvent["event_type"];
  sequenceIndex: number;
  actor: WorldEvent["actor"];
  payload: Record<string, unknown>;
}): Promise<WorldEvent> {
  // 先验证 run 归属
  const run = await getChallengeRun(params.userId, params.runId);
  if (!run) throw new RunNotFoundError();
  if (run.status !== "active") throw new InvalidRunStateError("Run is not active");

  const evt = createWorldEvent({
    runId: params.runId,
    eventType: params.eventType,
    sequenceIndex: params.sequenceIndex,
    actor: params.actor,
    payload: params.payload,
  });

  const admin = createSupabaseAdminClient();
  if (!admin) return evt;
  const { error } = await admin.from("world_events").insert({
    id: evt.id,
    run_id: evt.run_id,
    event_type: evt.event_type,
    sequence_index: evt.sequence_index,
    actor: evt.actor,
    payload: evt.payload,
    created_at: evt.created_at,
  });
  if (error) throw error;
  return evt;
}

// ── decision events ───────────────────────────────────────────────
export async function insertDecisionEvent(params: {
  userId: string;
  runId: string;
  worldEventId: string;
  judgment: string;
  chosenAction: string;
  expectedOutcome: string;
  confidence: DecisionEvent["confidence"];
  rejectedAlternatives: string[];
  evidenceBasis: string[];
}): Promise<DecisionEvent> {
  const run = await getChallengeRun(params.userId, params.runId);
  if (!run) throw new RunNotFoundError();
  if (run.status !== "active") throw new InvalidRunStateError("Run is not active");

  // 防止同一 run 内重复决策（同一 world_event_id 只能有一个 decision）
  const admin = createSupabaseAdminClient();
  if (admin) {
    const { data: existing } = await admin
      .from("decision_events")
      .select("id")
      .eq("run_id", params.runId)
      .eq("world_event_id", params.worldEventId)
      .maybeSingle();
    if (existing) throw new DuplicateDecisionError();
  }

  const dec = createDecisionEvent({
    runId: params.runId,
    worldEventId: params.worldEventId,
    judgment: params.judgment,
    chosenAction: params.chosenAction,
    expectedOutcome: params.expectedOutcome,
    confidence: params.confidence,
    rejectedAlternatives: params.rejectedAlternatives,
    evidenceBasis: params.evidenceBasis,
  });

  if (!admin) return dec;
  const { error } = await admin.from("decision_events").insert({
    id: dec.id,
    run_id: dec.run_id,
    world_event_id: dec.world_event_id,
    judgment: dec.judgment,
    chosen_action: dec.chosen_action,
    expected_outcome: dec.expected_outcome,
    confidence: dec.confidence,
    rejected_alternatives: dec.rejected_alternatives,
    evidence_basis: dec.evidence_basis,
    consequences_revealed: false, // 强制初始值
    created_at: dec.created_at,
  });
  if (error) throw error;
  return dec;
}

export async function revealDecisionConsequences(
  userId: string,
  runId: string,
  decisionEventId: string
): Promise<DecisionEvent> {
  const run = await getChallengeRun(userId, runId);
  if (!run) throw new RunNotFoundError();

  const admin = createSupabaseAdminClient();
  if (!admin) {
    // demo mode: return updated object without DB
    return {
      id: decisionEventId,
      run_id: runId,
      world_event_id: "",
      judgment: "",
      chosen_action: "",
      expected_outcome: "",
      confidence: "medium",
      rejected_alternatives: [],
      evidence_basis: [],
      consequences_revealed: true,
      created_at: new Date().toISOString(),
    };
  }

  // 防止重复揭示
  const { data: existing } = await admin
    .from("decision_events")
    .select("*")
    .eq("id", decisionEventId)
    .eq("run_id", runId)
    .maybeSingle();

  if (!existing) throw new RunNotFoundError();
  if (existing.consequences_revealed) throw new AlreadyRevealedError();

  const { data, error } = await admin
    .from("decision_events")
    .update({ consequences_revealed: true })
    .eq("id", decisionEventId)
    .eq("run_id", runId)
    .select("*")
    .single();
  if (error) throw error;
  return data as DecisionEvent;
}

// ── interventions ──────────────────────────────────────────────────
export async function insertIntervention(params: {
  userId: string;
  runId: string;
  decisionEventId: string | null;
  interventionType: Intervention["intervention_type"];
  content: string;
  modelVersion: string;
  worldVersion: string;
}): Promise<Intervention> {
  const run = await getChallengeRun(params.userId, params.runId);
  if (!run) throw new RunNotFoundError();

  const intervention = createIntervention({
    runId: params.runId,
    decisionEventId: params.decisionEventId,
    interventionType: params.interventionType,
    content: params.content,
    modelVersion: params.modelVersion,
    worldVersion: params.worldVersion,
  });

  const admin = createSupabaseAdminClient();
  if (!admin) return intervention;
  const { error } = await admin.from("interventions").insert({
    id: intervention.id,
    run_id: intervention.run_id,
    decision_event_id: intervention.decision_event_id,
    intervention_type: intervention.intervention_type,
    content: intervention.content,
    model_version: intervention.model_version,
    world_version: intervention.world_version,
    triggered_at: intervention.triggered_at,
  });
  if (error) throw error;
  return intervention;
}

// ── judgment profile ───────────────────────────────────────────────
export async function getJudgmentProfile(
  userId: string
): Promise<JudgmentHypothesis[]> {
  const admin = createSupabaseAdminClient();
  if (!admin) return [];
  const { data, error } = await admin
    .from("judgment_hypotheses")
    .select("*")
    .eq("user_id", userId)
    .order("last_updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as JudgmentHypothesis[];
}

export async function upsertHypothesisEvidence(
  evidence: HypothesisEvidence
): Promise<void> {
  if (!isEvidenceTraceable(evidence)) {
    throw new Error("Evidence is not traceable: missing event/world/model version");
  }
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  const { error } = await admin.from("hypothesis_evidence").upsert({
    id: evidence.id,
    hypothesis_id: evidence.hypothesis_id,
    decision_event_id: evidence.decision_event_id,
    evidence_type: evidence.evidence_type,
    world_id: evidence.world_id,
    world_version: evidence.world_version,
    model_version: evidence.model_version,
    transfer_world_id: evidence.transfer_world_id,
    created_at: evidence.created_at,
  });
  if (error) throw error;
}

// ── domain errors ──────────────────────────────────────────────────
export class RunNotFoundError extends Error {
  constructor() {
    super("Challenge run not found or access denied");
    this.name = "RunNotFoundError";
  }
}

export class InvalidRunStateError extends Error {
  constructor(detail: string) {
    super(`Invalid run state: ${detail}`);
    this.name = "InvalidRunStateError";
  }
}

export class DuplicateDecisionError extends Error {
  constructor() {
    super("A decision event already exists for this world event in this run");
    this.name = "DuplicateDecisionError";
  }
}

export class AlreadyRevealedError extends Error {
  constructor() {
    super("Consequences have already been revealed for this decision event");
    this.name = "AlreadyRevealedError";
  }
}
