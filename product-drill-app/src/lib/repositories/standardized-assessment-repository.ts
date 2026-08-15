import { createSupabaseAdminClient } from "../supabase/admin";
import { buildDiagnosticAssessmentReport, createAssessmentBlueprint, publishAssessmentBlueprint, startAssessmentRun, submitAssessmentResponse, type AssessmentItem } from "../standardized-assessment";
import { isLocalRuntimeFallbackEnabled, withLocalRuntimeState } from "../local-runtime-store";

async function requireAdmin(userId: string) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    if (!isLocalRuntimeFallbackEnabled()) throw new Error("Assessment persistence is not configured");
    return null;
  }
  const { data, error } = await admin.from("profiles").select("account_role").eq("id", userId).maybeSingle();
  if (error) throw error;
  if (data?.account_role !== "admin") throw new Error("Admin role required");
  return admin;
}

function rowToItem(row: { item_key: string; pool_kind: "assessment" | "anchor"; prompt_snapshot: Record<string, unknown>; rubric_snapshot: Record<string, unknown> }): AssessmentItem {
  const prompt = typeof row.prompt_snapshot.prompt === "string" ? row.prompt_snapshot.prompt : JSON.stringify(row.prompt_snapshot);
  const stage = row.prompt_snapshot.stage;
  if (stage !== "independent_judgment" && stage !== "ai_work_sample" && stage !== "anchor_check") throw new Error("Assessment item stage is invalid");
  return { itemKey: row.item_key, poolKind: row.pool_kind, stage, prompt, rubric: row.rubric_snapshot, weight: typeof row.rubric_snapshot.weight === "number" ? row.rubric_snapshot.weight : 1 };
}

export async function createAssessmentBlueprintRecord(userId: string, input: { roleKey: string; version: string; rubricVersion: string; items: AssessmentItem[] }) {
  const admin = await requireAdmin(userId);
  const blueprint = publishAssessmentBlueprint(createAssessmentBlueprint({ roleKey: input.roleKey, version: input.version, rubricVersion: input.rubricVersion, items: input.items }));
  if (!admin) {
    return withLocalRuntimeState((state) => {
      const id = blueprint.id.replace(/^blueprint-/, "");
      const row = { id, role_key: blueprint.roleKey, version: blueprint.version, rubric_version: blueprint.rubricVersion, competency_matrix: blueprint.items.map((item) => item.rubric), stage_order: blueprint.items.map((item) => item.itemKey), status: blueprint.status, created_by: userId, created_at: new Date().toISOString() };
      state.assessmentBlueprints.push(row);
      state.assessmentItems.push(...blueprint.items.map((item) => ({ blueprint_id: id, pool_kind: item.poolKind, item_key: item.itemKey, prompt_snapshot: { prompt: item.prompt, stage: item.stage }, rubric_snapshot: { ...item.rubric, weight: item.weight }, governance_status: "approved" })));
      return row;
    });
  }
  const { data, error } = await admin.from("assessment_blueprints").insert({ role_key: blueprint.roleKey, version: blueprint.version, rubric_version: blueprint.rubricVersion, competency_matrix: blueprint.items.map((item) => item.rubric), stage_order: blueprint.items.map((item) => item.itemKey), status: blueprint.status, created_by: userId }).select("id,role_key,version,rubric_version,status,stage_order").single();
  if (error) throw error;
  const rows = blueprint.items.map((item) => ({ blueprint_id: data.id, pool_kind: item.poolKind, item_key: item.itemKey, prompt_snapshot: { prompt: item.prompt, stage: item.stage }, rubric_snapshot: { ...item.rubric, weight: item.weight }, governance_status: "approved" }));
  const { error: itemError } = await admin.from("assessment_item_pools").insert(rows);
  if (itemError) throw itemError;
  return data;
}

export async function listAssessmentBlueprintsRecord() {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    if (!isLocalRuntimeFallbackEnabled()) return [];
    return withLocalRuntimeState((state) => state.assessmentBlueprints.filter((item) => item.status === "pilot"));
  }
  const { data, error } = await admin.from("assessment_blueprints").select("id,role_key,version,rubric_version,status,stage_order").eq("status", "pilot").order("created_at", { ascending: false }).limit(50);
  if (error) throw error;
  return data ?? [];
}

export async function startAssessmentRunRecord(userId: string, blueprintId: string, mode: "pilot" | "verified" = "pilot") {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    if (!isLocalRuntimeFallbackEnabled()) throw new Error("Assessment persistence is not configured");
    return withLocalRuntimeState((state) => {
      const row = state.assessmentBlueprints.find((item) => item.id === blueprintId && item.status === "pilot");
      if (!row) throw new Error("Assessment blueprint is not available");
      const items = state.assessmentItems
        .filter((item) => item.blueprint_id === blueprintId && item.governance_status === "approved")
        .map((row) => rowToItem(row as {
          item_key: string;
          pool_kind: "assessment" | "anchor";
          prompt_snapshot: Record<string, unknown>;
          rubric_snapshot: Record<string, unknown>;
        }));
      const blueprint = publishAssessmentBlueprint({ id: `blueprint-${blueprintId}`, roleKey: String(row.role_key), version: String(row.version), rubricVersion: String(row.rubric_version), items, status: "pilot" });
      const run = startAssessmentRun(blueprint, userId, mode);
      const id = run.id.replace(/^assessment-/, "");
      const result = { id, blueprint_id: blueprintId, user_id: userId, mode, item_order: run.itemOrder, current_index: 0, status: "in_progress", started_at: new Date().toISOString() };
      state.assessmentRuns.push(result);
      return result;
    });
  }
  const { data: blueprintRow, error: blueprintError } = await admin.from("assessment_blueprints").select("id,role_key,version,rubric_version,status,stage_order").eq("id", blueprintId).eq("status", "pilot").maybeSingle();
  if (blueprintError) throw blueprintError;
  if (!blueprintRow) throw new Error("Assessment blueprint is not available");
  const { data: itemRows, error: itemError } = await admin.from("assessment_item_pools").select("item_key,pool_kind,prompt_snapshot,rubric_snapshot").eq("blueprint_id", blueprintId).eq("governance_status", "approved").in("pool_kind", ["assessment", "anchor"]);
  if (itemError) throw itemError;
  const items = (itemRows ?? []).map(rowToItem);
  const blueprint = publishAssessmentBlueprint({ id: blueprintRow.id, roleKey: blueprintRow.role_key, version: blueprintRow.version, rubricVersion: blueprintRow.rubric_version, items, status: "pilot" });
  const run = startAssessmentRun(blueprint, userId, mode);
  const { data, error } = await admin.from("assessment_runs").insert({ id: run.id.replace("assessment-", ""), blueprint_id: blueprintId, user_id: userId, mode, item_order: run.itemOrder, current_index: 0, status: "in_progress" }).select("id,blueprint_id,user_id,mode,item_order,current_index,status,started_at").single();
  if (error) throw error;
  return data;
}

export async function submitAssessmentResponseRecord(userId: string, runId: string, input: { itemKey: string; response: Record<string, unknown> }) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    if (!isLocalRuntimeFallbackEnabled()) throw new Error("Assessment persistence is not configured");
    return withLocalRuntimeState((state) => {
      const runRow = state.assessmentRuns.find((item) => item.id === runId && item.user_id === userId);
      if (!runRow) throw new Error("Assessment run is not available");
      const items = state.assessmentItems
        .filter((item) => item.blueprint_id === runRow.blueprint_id && item.governance_status === "approved")
        .map((row) => rowToItem(row as {
          item_key: string;
          pool_kind: "assessment" | "anchor";
          prompt_snapshot: Record<string, unknown>;
          rubric_snapshot: Record<string, unknown>;
        }));
      const responses = state.assessmentResponses
        .filter((item) => item.run_id === runId)
        .map((item) => ({
          itemKey: String(item.item_key),
          stage: item.stage as "independent_judgment" | "ai_work_sample" | "anchor_check",
          response: item.response as Record<string, unknown>,
          submittedAt: String(item.submitted_at),
        }));
      const run = { id: `assessment-${runId}`, blueprintId: String(runRow.blueprint_id), userId, mode: runRow.mode as "pilot" | "verified", itemOrder: runRow.item_order as string[], currentIndex: Number(runRow.current_index), status: runRow.status as "in_progress" | "submitted", responses } as Parameters<typeof submitAssessmentResponse>[0];
      const updated = submitAssessmentResponse(run, { id: `blueprint-${runRow.blueprint_id}`, roleKey: "", version: "", rubricVersion: "", items, status: "pilot" }, input.itemKey, input.response);
      const item = items.find((candidate) => candidate.itemKey === input.itemKey);
      if (!item) throw new Error("Assessment item is not in the blueprint");
      state.assessmentResponses.push({ id: crypto.randomUUID(), run_id: runId, item_key: input.itemKey, response: input.response, stage: item.stage, submitted_at: new Date().toISOString() });
      runRow.current_index = updated.currentIndex;
      runRow.status = updated.status;
      runRow.submitted_at = updated.status === "submitted" ? new Date().toISOString() : null;
      return runRow;
    });
  }
  const { data: runRow, error: runError } = await admin.from("assessment_runs").select("id,blueprint_id,user_id,mode,item_order,current_index,status").eq("id", runId).eq("user_id", userId).maybeSingle();
  if (runError) throw runError;
  if (!runRow) throw new Error("Assessment run is not available");
  const { data: itemRows, error: itemError } = await admin.from("assessment_item_pools").select("item_key,pool_kind,prompt_snapshot,rubric_snapshot").eq("blueprint_id", runRow.blueprint_id).in("pool_kind", ["assessment", "anchor"]);
  if (itemError) throw itemError;
  const items = (itemRows ?? []).map(rowToItem);
  const run = { id: `assessment-${runRow.id}`, blueprintId: runRow.blueprint_id, userId, mode: runRow.mode, itemOrder: runRow.item_order as string[], currentIndex: runRow.current_index, status: runRow.status, responses: [] } as Parameters<typeof submitAssessmentResponse>[0];
  const updated = submitAssessmentResponse(run, { id: runRow.blueprint_id, roleKey: "", version: "", rubricVersion: "", items, status: "pilot" }, input.itemKey, input.response);
  const item = items.find((candidate) => candidate.itemKey === input.itemKey)!;
  const { error: responseError } = await admin.from("assessment_responses").insert({ run_id: runRow.id, item_key: input.itemKey, response: input.response, stage: item.stage });
  if (responseError) throw responseError;
  const { data, error } = await admin.from("assessment_runs").update({ current_index: updated.currentIndex, status: updated.status, submitted_at: updated.status === "submitted" ? new Date().toISOString() : null }).eq("id", runRow.id).eq("user_id", userId).select("id,blueprint_id,user_id,mode,item_order,current_index,status,submitted_at").single();
  if (error) throw error;
  return data;
}

export async function createAssessmentReportRecord(userId: string, runId: string) {
  const admin = await requireAdmin(userId);
  if (!admin) {
    return withLocalRuntimeState((state) => {
      const runRow = state.assessmentRuns.find((item) => item.id === runId);
      if (!runRow || runRow.status !== "submitted") throw new Error("Assessment run is not ready for reporting");
      const responses = state.assessmentResponses.filter((item) => item.run_id === runId);
      const evaluations = state.assessmentEvaluations.filter((item) => item.run_id === runId);
      const report = buildDiagnosticAssessmentReport({
        id: `assessment-${runId}`,
        blueprintId: String(runRow.blueprint_id),
        userId: String(runRow.user_id),
        mode: runRow.mode as "pilot" | "verified",
        itemOrder: runRow.item_order as string[],
        currentIndex: Number(runRow.current_index),
        status: "submitted",
        responses: responses.map((item) => ({
          itemKey: String(item.item_key),
          stage: item.stage as "independent_judgment" | "ai_work_sample" | "anchor_check",
          response: item.response as Record<string, unknown>,
          submittedAt: String(item.submitted_at),
        })),
      }, evaluations.map((item) => ({ itemKey: String(item.item_key), evaluatorType: item.evaluator_type as "human" | "ai" | "deterministic", score: Number(item.score) })));
      const row = { id: crypto.randomUUID(), run_id: runId, independent_score: report.independentScore, work_sample_score: report.workSampleScore, confidence_interval: report.confidenceInterval, limitations: report.limitations, report_status: report.reportStatus, created_at: new Date().toISOString() };
      state.assessmentReports = state.assessmentReports.filter((item) => item.run_id !== runId);
      state.assessmentReports.push(row);
      runRow.status = "reported";
      return row;
    });
  }
  const { data: runRow, error: runError } = await admin.from("assessment_runs").select("id,blueprint_id,user_id,item_order,current_index,status").eq("id", runId).maybeSingle();
  if (runError) throw runError;
  if (!runRow || runRow.status !== "submitted") throw new Error("Assessment run is not ready for reporting");
  const { data: responses, error: responseError } = await admin.from("assessment_responses").select("item_key,stage,response,submitted_at").eq("run_id", runId).order("submitted_at", { ascending: true });
  if (responseError) throw responseError;
  const { data: evaluations, error: evaluationError } = await admin.from("assessment_evaluations").select("item_key,evaluator_type,score").eq("run_id", runId);
  if (evaluationError) throw evaluationError;
  const report = buildDiagnosticAssessmentReport({ id: `assessment-${runId}`, blueprintId: runRow.blueprint_id, userId: runRow.user_id, mode: "pilot", itemOrder: runRow.item_order as string[], currentIndex: runRow.current_index, status: "submitted", responses: (responses ?? []).map((item) => ({ itemKey: item.item_key, stage: item.stage, response: item.response as Record<string, unknown>, submittedAt: item.submitted_at })) }, (evaluations ?? []).map((item) => ({ itemKey: item.item_key, evaluatorType: item.evaluator_type, score: item.score })));
  const { data, error } = await admin.from("assessment_reports").upsert({ run_id: runId, independent_score: report.independentScore, work_sample_score: report.workSampleScore, confidence_interval: report.confidenceInterval, limitations: report.limitations, report_status: report.reportStatus }).select("id,run_id,independent_score,work_sample_score,confidence_interval,limitations,report_status,created_at").single();
  if (error) throw error;
  await admin.from("assessment_runs").update({ status: "reported" }).eq("id", runId);
  return data;
}

export async function recordAssessmentEvaluationRecord(userId: string, input: { runId: string; itemKey: string; evaluatorType: "human" | "ai" | "deterministic"; score: number; evidence?: Record<string, unknown>; confidence: number }) {
  const admin = await requireAdmin(userId);
  if (!admin) {
    return withLocalRuntimeState((state) => {
      if (!state.assessmentRuns.some((item) => item.id === input.runId)) throw new Error("Assessment run is not available");
      const evaluation = { id: crypto.randomUUID(), run_id: input.runId, item_key: input.itemKey, evaluator_type: input.evaluatorType, score: input.score, evidence: input.evidence ?? {}, confidence: input.confidence, created_at: new Date().toISOString() };
      state.assessmentEvaluations.push(evaluation);
      return evaluation;
    });
  }
  const { data, error } = await admin.from("assessment_evaluations").insert({ run_id: input.runId, item_key: input.itemKey, evaluator_type: input.evaluatorType, score: input.score, evidence: input.evidence ?? {}, confidence: input.confidence }).select("id,run_id,item_key,evaluator_type,score,evidence,confidence,created_at").single();
  if (error) throw error;
  return data;
}

export async function recordAssessmentFairnessMetricRecord(userId: string, input: { blueprintId: string; cohortLabel: string; sampleSize: number; meanScore?: number; completionRate?: number; adverseDifference?: number; metadata?: Record<string, unknown> }) {
  const admin = await requireAdmin(userId);
  if (!admin) {
    return withLocalRuntimeState((state) => {
      const metric = { id: crypto.randomUUID(), blueprint_id: input.blueprintId, cohort_label: input.cohortLabel.trim(), sample_size: input.sampleSize, mean_score: input.meanScore ?? null, completion_rate: input.completionRate ?? null, adverse_difference: input.adverseDifference ?? null, metadata: input.metadata ?? {}, measured_at: new Date().toISOString() };
      state.fairnessMetrics.push(metric);
      return metric;
    });
  }
  const { data, error } = await admin.from("assessment_fairness_metrics").insert({ blueprint_id: input.blueprintId, cohort_label: input.cohortLabel.trim(), sample_size: input.sampleSize, mean_score: input.meanScore ?? null, completion_rate: input.completionRate ?? null, adverse_difference: input.adverseDifference ?? null, metadata: input.metadata ?? {} }).select("id,blueprint_id,cohort_label,sample_size,mean_score,completion_rate,adverse_difference,metadata,measured_at").single();
  if (error) throw error;
  return data;
}

export async function getAssessmentReportRecord(userId: string, runId: string) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    if (!isLocalRuntimeFallbackEnabled()) throw new Error("Assessment persistence is not configured");
    return withLocalRuntimeState((state) => {
      const run = state.assessmentRuns.find((item) => item.id === runId && item.user_id === userId);
      if (!run) throw new Error("Assessment report is not available");
      return state.assessmentReports.find((item) => item.run_id === runId) ?? null;
    });
  }
  const { data: run, error: runError } = await admin.from("assessment_runs").select("user_id").eq("id", runId).maybeSingle();
  if (runError) throw runError;
  if (!run || run.user_id !== userId) throw new Error("Assessment report is not available");
  const { data, error } = await admin.from("assessment_reports").select("id,run_id,independent_score,work_sample_score,confidence_interval,limitations,report_status,created_at").eq("run_id", runId).maybeSingle();
  if (error) throw error;
  return data;
}
