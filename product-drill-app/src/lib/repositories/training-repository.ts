import { getScenario } from "../training-config";
import { isFormalRetryImprovement, type TrainingHistoryRecord } from "../training-history";
import type { TrainingSession } from "../training-session";
import { createSupabaseAdminClient } from "../supabase/admin";

export class SessionOwnershipError extends Error {
  constructor() {
    super("Session ownership conflict");
    this.name = "SessionOwnershipError";
  }
}

export function assertSessionOwner(existingOwnerId: string | null | undefined, requestedUserId: string): void {
  if (existingOwnerId && existingOwnerId !== requestedUserId) throw new SessionOwnershipError();
}

async function verifySessionOwner(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  userId: string,
  sessionId: string
) {
  const { data, error } = await admin.from("training_sessions").select("user_id").eq("id", sessionId).maybeSingle();
  if (error) throw error;
  assertSessionOwner(data?.user_id, userId);
}

export async function getHistoryRecords(userId: string): Promise<TrainingHistoryRecord[]> {
  const admin = createSupabaseAdminClient();
  if (!admin) return [];
  const { data, error } = await admin.from("training_sessions").select("snapshot").eq("user_id", userId).not("completed_at", "is", null).order("completed_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => row.snapshot as TrainingHistoryRecord).filter(Boolean);
}

export async function getSessionSnapshot(userId: string, sessionId: string): Promise<TrainingSession | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const { data, error } = await admin.from("training_sessions").select("snapshot").eq("id", sessionId).eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return (data?.snapshot as TrainingSession | null) ?? null;
}

export async function getHistoryRecord(userId: string, sessionId: string): Promise<TrainingHistoryRecord | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const { data, error } = await admin.from("training_sessions").select("snapshot").eq("id", sessionId).eq("user_id", userId).not("completed_at", "is", null).maybeSingle();
  if (error) throw error;
  return (data?.snapshot as TrainingHistoryRecord | null) ?? null;
}

async function ensureScenarioVersion(scenarioId: string, scenarioVersion: number, rubricVersion: string) {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  const scenario = getScenario(scenarioId);
  const { error: scenarioError } = await admin.from("scenarios").upsert({
    id: scenario.id,
    title: scenario.title,
    industry: scenario.industry,
    active_version: scenarioVersion,
    status: "published",
    updated_at: new Date().toISOString()
  });
  if (scenarioError) throw scenarioError;
  const { error: versionError } = await admin.from("scenario_versions").upsert({
    scenario_id: scenario.id,
    version: scenarioVersion,
    primary_skill_id: scenario.skillId,
    rubric_version: rubricVersion,
    payload: scenario,
    source_notes: "Bundled direction A scenario; expert review pending.",
    review_status: "published"
  });
  if (versionError) throw versionError;
}

export async function saveSessionSnapshot(userId: string, session: TrainingSession): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  if (!admin) return false;
  await verifySessionOwner(admin, userId, session.id);
  await ensureScenarioVersion(session.scenarioId, session.scenarioVersion, session.rubricVersion);
  const { error } = await admin.from("training_sessions").upsert({
    id: session.id,
    user_id: userId,
    scenario_id: session.scenarioId,
    scenario_version: session.scenarioVersion,
    mode: session.mode,
    stage: session.stage,
    engine: session.engine,
    model_version: session.modelVersion,
    rubric_version: session.rubricVersion,
    hints_used: session.hintsUsed,
    covered_skills: session.coveredSkills,
    snapshot: session,
    updated_at: new Date().toISOString()
  });
  if (error) throw error;
  return true;
}

export async function saveHistoryRecord(userId: string, record: TrainingHistoryRecord): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  if (!admin) return false;
  await verifySessionOwner(admin, userId, record.sessionId);
  await ensureScenarioVersion(record.scenarioId, record.scenarioVersion, record.rubricVersion);
  const sessionRow = {
    id: record.sessionId,
    user_id: userId,
    scenario_id: record.scenarioId,
    scenario_version: record.scenarioVersion,
    mode: record.mode,
    stage: "complete",
    engine: record.engine,
    model_version: record.modelVersion,
    rubric_version: record.rubricVersion,
    hints_used: 0,
    covered_skills: record.evaluation.dimensions.filter((item) => item.score > 0).map((item) => item.id),
    snapshot: record,
    completed_at: record.completedAt,
    updated_at: new Date().toISOString()
  };
  const { error: sessionError } = await admin.from("training_sessions").upsert(sessionRow);
  if (sessionError) throw sessionError;

  if (record.messages.length) {
    const { error } = await admin.from("messages").upsert(record.messages.map((message) => ({
      id: message.id, session_id: record.sessionId, role: message.role, content: message.content,
      turn_index: message.turnIndex, revealed_skill: message.revealedSkill ?? null
    })));
    if (error) throw error;
  }

  if (record.judgment) {
    const { error } = await admin.from("product_judgments").upsert({ session_id: record.sessionId, ...{
      target_user: record.judgment.targetUser, current_workflow: record.judgment.currentWorkflow,
      core_problem: record.judgment.coreProblem, problem_impact: record.judgment.problemImpact,
      alternative: record.judgment.alternative, recommendation: record.judgment.recommendation,
      success_metric: record.judgment.successMetric, biggest_assumption: record.judgment.biggestAssumption
    }});
    if (error) throw error;
  }

  const { error: evaluationError } = await admin.from("evaluations").upsert({
    id: record.evaluation.id, session_id: record.sessionId, total_score: record.totalScore,
    summary: record.evaluation.summary, confidence: record.evaluation.confidence, engine: record.evaluation.engine,
    model_version: record.evaluation.modelVersion, rubric_version: record.evaluation.rubricVersion,
    scenario_version: record.evaluation.scenarioVersion
  });
  if (evaluationError) throw evaluationError;

  const { error: evidenceError } = await admin.from("evaluation_evidence").upsert(record.evaluation.dimensions.map((item) => ({
    evaluation_id: record.evaluation.id, skill_id: item.id, level: item.level, confidence: item.confidence,
    evidence_message_ids: item.evidenceMessageIds, evidence_quotes: item.evidenceQuotes,
    why: item.why, next_action: item.nextAction
  })), { onConflict: "evaluation_id,skill_id" });
  if (evidenceError) throw evidenceError;

  if (record.retry) {
    const { error } = await admin.from("retry_attempts").upsert({
      id: record.retry.id ?? `retry-${record.sessionId}-${record.retry.issueId}`,
      session_id: record.sessionId,
      evaluation_id: record.evaluation.id,
      issue_id: record.retry.issueId,
      target_skill_id: record.retry.targetSkill,
      answer: record.retry.answer,
      improved: record.retry.improved,
      feedback: record.retry.feedback,
      engine: record.retry.engine ?? "deterministic",
      model_version: record.retry.modelVersion ?? "deterministic-v1"
    });
    if (error) throw error;
  }

  if (record.engine === "openai") {
    const evidenceRows = record.evaluation.dimensions.filter((item) => item.evidenceMessageIds.length).map((item) => ({
      user_id: userId, session_id: record.sessionId, skill_id: item.id, level: item.level,
      independent: item.level === "独立体现" || item.level === "稳定且深入",
      improved: isFormalRetryImprovement(record.retry, item.id),
      scenario_version: record.scenarioVersion, rubric_version: record.rubricVersion, model_version: record.modelVersion
    }));
    if (evidenceRows.length) {
      const { error } = await admin.from("ability_evidence").upsert(evidenceRows, { onConflict: "user_id,session_id,skill_id" });
      if (error) throw error;
    }
  }
  return true;
}
