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

type DemoChallengeStore = {
  runs: Map<string, ChallengeRun>;
  worldEvents: Map<string, WorldEvent>;
  decisionEvents: Map<string, DecisionEvent>;
  interventions: Map<string, Intervention>;
  hypotheses: Map<string, JudgmentHypothesis>;
  hypothesisEvidence: Map<string, HypothesisEvidence>;
};

export type ChallengeDecisionRecord = {
  run: ChallengeRun;
  decision: DecisionEvent;
};

export type ChallengeDecisionContext = ChallengeDecisionRecord & {
  events: WorldEvent[];
  interventions: Intervention[];
};

const demoGlobal = globalThis as typeof globalThis & {
  __productDrillDemoChallengeStore?: DemoChallengeStore;
};

const demoStore = demoGlobal.__productDrillDemoChallengeStore ??= {
  runs: new Map(),
  worldEvents: new Map(),
  decisionEvents: new Map(),
  interventions: new Map(),
  hypotheses: new Map(),
  hypothesisEvidence: new Map(),
};

// Next.js hot reload can retain a store created before new collections existed.
demoStore.hypotheses ??= new Map();
demoStore.hypothesisEvidence ??= new Map();

// ── challenge runs ────────────────────────────────────────────────
export async function insertChallengeRun(
  userId: string,
  worldId: string,
  worldVersion: string,
  modelVersion: string
): Promise<ChallengeRun> {
  const run = createChallengeRun({ userId, worldId, worldVersion, modelVersion });
  const admin = createSupabaseAdminClient();
  if (!admin) {
    demoStore.runs.set(run.id, run);
    return run;
  }
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
  if (!admin) {
    const run = demoStore.runs.get(runId);
    return run?.user_id === userId ? run : null;
  }
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
  if (!admin) {
    const run = demoStore.runs.get(runId);
    if (run?.user_id === userId && run.status === "active") {
      demoStore.runs.set(runId, {
        ...run,
        status: "completed",
        completed_at: new Date().toISOString(),
      });
    }
    return;
  }
  const { error } = await admin
    .from("challenge_runs")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", runId)
    .eq("user_id", userId)
    .eq("status", "active"); // 只允许从 active 转为 completed
  if (error) throw error;
}

export async function getChallengeDecisionRecords(
  userId: string
): Promise<ChallengeDecisionRecord[]> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    const runs = [...demoStore.runs.values()]
      .filter((run) => run.user_id === userId && run.status === "completed")
      .sort((a, b) => Date.parse(b.completed_at ?? b.started_at) - Date.parse(a.completed_at ?? a.started_at));
    return runs.flatMap((run) =>
      [...demoStore.decisionEvents.values()]
        .filter((decision) => decision.run_id === run.id)
        .map((decision) => ({ run, decision }))
    );
  }

  const { data: runs, error: runsError } = await admin
    .from("challenge_runs")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false });
  if (runsError) throw runsError;
  const typedRuns = (runs ?? []) as ChallengeRun[];
  if (typedRuns.length === 0) return [];

  const runById = new Map(typedRuns.map((run) => [run.id, run]));
  const { data: decisions, error: decisionsError } = await admin
    .from("decision_events")
    .select("*")
    .in("run_id", typedRuns.map((run) => run.id));
  if (decisionsError) throw decisionsError;
  return ((decisions ?? []) as DecisionEvent[])
    .flatMap((decision) => {
      const run = runById.get(decision.run_id);
      return run ? [{ run, decision }] : [];
    })
    .sort((a, b) => Date.parse(b.run.completed_at ?? b.run.started_at) - Date.parse(a.run.completed_at ?? a.run.started_at));
}

export async function getChallengeDecisionContext(
  userId: string,
  decisionEventId: string
): Promise<ChallengeDecisionContext | null> {
  const admin = createSupabaseAdminClient();
  let decision: DecisionEvent | null;
  if (!admin) {
    decision = demoStore.decisionEvents.get(decisionEventId) ?? null;
  } else {
    const { data, error } = await admin
      .from("decision_events")
      .select("*")
      .eq("id", decisionEventId)
      .maybeSingle();
    if (error) throw error;
    decision = data as DecisionEvent | null;
  }
  if (!decision) return null;

  const run = await getChallengeRun(userId, decision.run_id);
  if (!run) return null;
  const [events, interventions] = await Promise.all([
    getWorldEventsForRun(userId, run.id),
    getInterventionsForRun(userId, run.id),
  ]);
  return { run, decision, events, interventions };
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
  if (!admin) {
    demoStore.worldEvents.set(evt.id, evt);
    return evt;
  }
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

export async function getWorldEventsForRun(
  userId: string,
  runId: string
): Promise<WorldEvent[]> {
  const run = await getChallengeRun(userId, runId);
  if (!run) throw new RunNotFoundError();

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return [...demoStore.worldEvents.values()]
      .filter((event) => event.run_id === runId)
      .sort((a, b) => a.sequence_index - b.sequence_index);
  }
  const { data, error } = await admin
    .from("world_events")
    .select("*")
    .eq("run_id", runId)
    .order("sequence_index", { ascending: true });
  if (error) throw error;
  return (data ?? []) as WorldEvent[];
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
  } else {
    const duplicate = [...demoStore.decisionEvents.values()].some(
      (item) => item.run_id === params.runId && item.world_event_id === params.worldEventId
    );
    if (duplicate) throw new DuplicateDecisionError();
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

  if (!admin) {
    demoStore.decisionEvents.set(dec.id, dec);
    return dec;
  }
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
  if (error?.code === "23505") throw new DuplicateDecisionError();
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
    const decision = demoStore.decisionEvents.get(decisionEventId);
    if (!decision || decision.run_id !== runId) throw new RunNotFoundError();
    if (decision.consequences_revealed) throw new AlreadyRevealedError();
    const revealed = { ...decision, consequences_revealed: true };
    demoStore.decisionEvents.set(decisionEventId, revealed);
    // FB-006：看到结果（揭示后果）即视为完成该世界，避免复盘页/画像查不到记录。
    const run = demoStore.runs.get(runId);
    if (run && run.user_id === userId && run.status === "active") {
      demoStore.runs.set(runId, { ...run, status: "completed", completed_at: new Date().toISOString() });
    }
    return revealed;
  }

  const { data, error } = await admin
    .from("decision_events")
    .update({ consequences_revealed: true })
    .eq("id", decisionEventId)
    .eq("run_id", runId)
    .eq("consequences_revealed", false)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    const { data: existing, error: lookupError } = await admin
      .from("decision_events")
      .select("id")
      .eq("id", decisionEventId)
      .eq("run_id", runId)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!existing) throw new RunNotFoundError();
    throw new AlreadyRevealedError();
  }
  // FB-006：揭示后果后即视为完成该世界，让复盘页/判断画像能读到这条记录（反馈步仍可幂等补齐证据）。
  await admin.from("challenge_runs").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", runId).eq("status", "active");
  return data as DecisionEvent;
}

export async function getDecisionEvent(
  userId: string,
  runId: string,
  decisionEventId: string
): Promise<DecisionEvent | null> {
  const run = await getChallengeRun(userId, runId);
  if (!run) throw new RunNotFoundError();

  const admin = createSupabaseAdminClient();
  if (!admin) {
    const decision = demoStore.decisionEvents.get(decisionEventId);
    return decision?.run_id === runId ? decision : null;
  }
  const { data, error } = await admin
    .from("decision_events")
    .select("*")
    .eq("id", decisionEventId)
    .eq("run_id", runId)
    .maybeSingle();
  if (error) throw error;
  return data as DecisionEvent | null;
}

// ── interventions ──────────────────────────────────────────────────
export async function insertIntervention(params: {
  userId: string;
  runId: string;
  decisionEventId: string | null;
  interventionType: Intervention["intervention_type"];
  content: string;
  modelVersion: string;
}): Promise<Intervention> {
  const run = await getChallengeRun(params.userId, params.runId);
  if (!run) throw new RunNotFoundError();

  const intervention = createIntervention({
    runId: params.runId,
    decisionEventId: params.decisionEventId,
    interventionType: params.interventionType,
    content: params.content,
    modelVersion: params.modelVersion,
    worldVersion: run.world_version,
  });

  const admin = createSupabaseAdminClient();
  if (!admin) {
    demoStore.interventions.set(intervention.id, intervention);
    return intervention;
  }
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

export async function getInterventionsForRun(
  userId: string,
  runId: string
): Promise<Intervention[]> {
  const run = await getChallengeRun(userId, runId);
  if (!run) throw new RunNotFoundError();

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return [...demoStore.interventions.values()]
      .filter((intervention) => intervention.run_id === runId)
      .sort((a, b) => Date.parse(a.triggered_at) - Date.parse(b.triggered_at));
  }
  const { data, error } = await admin
    .from("interventions")
    .select("*")
    .eq("run_id", runId)
    .order("triggered_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Intervention[];
}

// ── judgment profile ───────────────────────────────────────────────
export async function getJudgmentProfile(
  userId: string
): Promise<JudgmentHypothesis[]> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return [...demoStore.hypotheses.values()]
      .filter((hypothesis) => hypothesis.user_id === userId)
      .sort((a, b) => Date.parse(b.last_updated_at) - Date.parse(a.last_updated_at));
  }
  const { data, error } = await admin
    .from("judgment_hypotheses")
    .select("*")
    .eq("user_id", userId)
    .order("last_updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as JudgmentHypothesis[];
}

/** 查询属于指定假设列表的所有证据记录 */
export async function getHypothesisEvidenceForProfile(
  hypothesisIds: string[]
): Promise<HypothesisEvidence[]> {
  if (hypothesisIds.length === 0) return [];
  const admin = createSupabaseAdminClient();
  if (!admin) {
    const allowed = new Set(hypothesisIds);
    return [...demoStore.hypothesisEvidence.values()]
      .filter((evidence) => allowed.has(evidence.hypothesis_id))
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  }
  const { data, error } = await admin
    .from("hypothesis_evidence")
    .select("*")
    .in("hypothesis_id", hypothesisIds)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as HypothesisEvidence[];
}

export async function upsertJudgmentHypothesis(
  hypothesis: JudgmentHypothesis
): Promise<JudgmentHypothesis> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    demoStore.hypotheses.set(hypothesis.id, hypothesis);
    return hypothesis;
  }
  const { data, error } = await admin
    .from("judgment_hypotheses")
    .upsert({
      id: hypothesis.id,
      user_id: hypothesis.user_id,
      habit_name: hypothesis.habit_name,
      trigger_conditions: hypothesis.trigger_conditions,
      confidence: hypothesis.confidence,
      supporting_evidence_ids: hypothesis.supporting_evidence_ids,
      counter_evidence_ids: hypothesis.counter_evidence_ids,
      last_updated_at: hypothesis.last_updated_at,
      created_at: hypothesis.created_at,
    }, { onConflict: "user_id,habit_name" })
    .select("*")
    .single();
  if (error) throw error;
  return data as JudgmentHypothesis;
}

export async function upsertHypothesisEvidence(
  evidence: HypothesisEvidence
): Promise<void> {
  if (!isEvidenceTraceable(evidence)) {
    throw new Error("Evidence is not traceable: missing event/world/model version");
  }
  const admin = createSupabaseAdminClient();
  if (!admin) {
    demoStore.hypothesisEvidence.set(evidence.id, evidence);
    return;
  }
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
