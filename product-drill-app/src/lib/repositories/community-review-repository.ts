import { createSupabaseAdminClient } from "../supabase/admin";
import { aggregateCommunityReviews, createAnonymizedSubjectId, type RawCommunityReview, type ReviewAggregate } from "../community-review";
import { checkReviewRateLimit } from "../community-governance";
import { aggregateCommunityReviewsWithAi } from "../ai/community-review-aggregate";
import { isLocalRuntimeFallbackEnabled, withLocalRuntimeState } from "../local-runtime-store";

async function requireAdmin(userId: string) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    if (!isLocalRuntimeFallbackEnabled()) throw new Error("Review persistence is not configured");
    return null;
  }
  const { data, error } = await admin.from("profiles").select("account_role").eq("id", userId).maybeSingle();
  if (error) throw error;
  if (data?.account_role !== "admin") throw new Error("Admin role required");
  return admin;
}

async function requireReviewer(userId: string, cohortId: string) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    if (!isLocalRuntimeFallbackEnabled()) throw new Error("Review persistence is not configured");
    const participant = await withLocalRuntimeState((state) => state.validationParticipants.find((item) => item.cohort_id === cohortId && item.user_id === userId && item.status === "active"));
    if (!participant || !["pm_reviewer", "hiring_reviewer", "researcher"].includes(String(participant.participant_role))) throw new Error("Reviewer participation required");
    return null;
  }
  const { data, error } = await admin
    .from("validation_participants")
    .select("participant_role,status")
    .eq("cohort_id", cohortId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  if (!data || !["pm_reviewer", "hiring_reviewer", "researcher"].includes(data.participant_role)) throw new Error("Reviewer participation required");
  return admin;
}

export async function createReviewPoolEntryRecord(userId: string, input: { cohortId: string; subjectUserId?: string; decisionEventId?: string; anchorCaseId?: string; conflictGroup?: string }) {
  const admin = await requireAdmin(userId);
  if (Boolean(input.decisionEventId) === Boolean(input.anchorCaseId)) throw new Error("A review pool entry must reference exactly one subject");
  if (!admin) {
    return withLocalRuntimeState((state) => {
      const entry = { id: crypto.randomUUID(), cohort_id: input.cohortId, subject_user_id: input.subjectUserId ?? null, decision_event_id: input.decisionEventId ?? null, anchor_case_id: input.anchorCaseId ?? null, anonymized_subject_id: createAnonymizedSubjectId(), conflict_group: input.conflictGroup ?? null, status: "ready" };
      state.reviewPoolEntries.push(entry);
      return entry;
    });
  }
  const { data, error } = await admin.from("review_pool_entries").insert({
    cohort_id: input.cohortId,
    subject_user_id: input.subjectUserId ?? null,
    decision_event_id: input.decisionEventId ?? null,
    anchor_case_id: input.anchorCaseId ?? null,
    anonymized_subject_id: createAnonymizedSubjectId(),
    conflict_group: input.conflictGroup ?? null,
    status: "ready",
  }).select("id,cohort_id,anonymized_subject_id,status,conflict_group,decision_event_id,anchor_case_id").single();
  if (error) throw error;
  return data;
}

export async function declareReviewerConflictRecord(userId: string, input: { cohortId: string; conflictGroup: string }) {
  const admin = await requireReviewer(userId, input.cohortId);
  if (!admin) {
    return withLocalRuntimeState((state) => {
      const conflict = { cohort_id: input.cohortId, reviewer_id: userId, conflict_group: input.conflictGroup.trim(), declared_at: new Date().toISOString() };
      state.reviewerConflicts = state.reviewerConflicts.filter((item) => !(item.cohort_id === input.cohortId && item.reviewer_id === userId && item.conflict_group === conflict.conflict_group));
      state.reviewerConflicts.push(conflict);
      return conflict;
    });
  }
  const { data, error } = await admin.from("reviewer_conflicts").upsert({ cohort_id: input.cohortId, reviewer_id: userId, conflict_group: input.conflictGroup.trim() }).select("cohort_id,reviewer_id,conflict_group,declared_at").single();
  if (error) throw error;
  return data;
}

export async function assignNextCommunityReviewRecord(userId: string, cohortId: string) {
  const admin = await requireReviewer(userId, cohortId);
  if (!admin) {
    return withLocalRuntimeState((state) => {
      const recent = state.validationAssignments.filter((item) => item.cohort_id === cohortId && item.reviewer_id === userId && new Date(String(item.assigned_at)).getTime() >= Date.now() - 60 * 60 * 1000).map((item) => String(item.assigned_at));
      const rate = checkReviewRateLimit(recent);
      if (!rate.allowed) throw new Error(`Review rate limit exceeded; retry after ${rate.retryAfterSeconds}s`);
      const conflicts = new Set(state.reviewerConflicts.filter((item) => item.cohort_id === cohortId && item.reviewer_id === userId).map((item) => String(item.conflict_group)));
      const assigned = new Set(state.validationAssignments.filter((item) => item.cohort_id === cohortId && item.reviewer_id === userId).map((item) => item.pool_entry_id));
      const eligible = state.reviewPoolEntries.filter((entry) => entry.cohort_id === cohortId && entry.status === "ready" && entry.subject_user_id !== userId && !assigned.has(entry.id) && !conflicts.has(String(entry.conflict_group ?? "")));
      if (!eligible.length) return null;
      const selected = eligible[Math.floor(Math.random() * eligible.length)];
      const assignment = { id: crypto.randomUUID(), cohort_id: cohortId, reviewer_id: userId, pool_entry_id: selected.id, decision_event_id: selected.decision_event_id, anchor_case_id: selected.anchor_case_id, anonymized_subject_id: selected.anonymized_subject_id, status: "assigned", conflict_declared: false, assigned_at: new Date().toISOString(), due_at: null };
      state.validationAssignments.push(assignment);
      const { decision_event_id: _decision, anchor_case_id: _anchor, reviewer_id: _reviewer, ...safe } = assignment;
      return safe;
    });
  }
  const rateWindow = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: recentAssignments, error: rateError } = await admin.from("blind_review_assignments").select("assigned_at").eq("cohort_id", cohortId).eq("reviewer_id", userId).gte("assigned_at", rateWindow);
  if (rateError) throw rateError;
  const rate = checkReviewRateLimit((recentAssignments ?? []).map((item) => item.assigned_at));
  if (!rate.allowed) throw new Error(`Review rate limit exceeded; retry after ${rate.retryAfterSeconds}s`);
  const { data: conflicts, error: conflictError } = await admin.from("reviewer_conflicts").select("conflict_group").eq("cohort_id", cohortId).eq("reviewer_id", userId);
  if (conflictError) throw conflictError;
  const conflictGroups = new Set((conflicts ?? []).map((item) => item.conflict_group));
  const { data: pool, error: poolError } = await admin.from("review_pool_entries").select("id,cohort_id,subject_user_id,decision_event_id,anchor_case_id,anonymized_subject_id,conflict_group,status").eq("cohort_id", cohortId).eq("status", "ready").limit(500);
  if (poolError) throw poolError;
  const { data: prior, error: priorError } = await admin.from("blind_review_assignments").select("pool_entry_id").eq("cohort_id", cohortId).eq("reviewer_id", userId).not("pool_entry_id", "is", null);
  if (priorError) throw priorError;
  const assigned = new Set((prior ?? []).map((item) => item.pool_entry_id));
  const eligible = (pool ?? []).filter((entry) => !assigned.has(entry.id) && entry.subject_user_id !== userId && !conflictGroups.has(entry.conflict_group ?? ""));
  if (!eligible.length) return null;
  const selected = eligible[Math.floor(Math.random() * eligible.length)];
  const { data, error } = await admin.from("blind_review_assignments").insert({
    cohort_id: cohortId,
    reviewer_id: userId,
    pool_entry_id: selected.id,
    decision_event_id: selected.decision_event_id,
    anchor_case_id: selected.anchor_case_id,
    anonymized_subject_id: selected.anonymized_subject_id,
    status: "assigned",
  }).select("id,cohort_id,pool_entry_id,anonymized_subject_id,status,conflict_declared,assigned_at,due_at").single();
  if (error) throw error;
  return data;
}

export async function aggregateCommunityReviewRecords(userId: string, poolEntryId: string, engine: "ai" | "deterministic" = "deterministic"): Promise<ReviewAggregate> {
  const admin = await requireAdmin(userId);
  if (!admin) {
    return withLocalRuntimeState(async (state) => {
      const assignmentIds = state.validationAssignments.filter((item) => item.pool_entry_id === poolEntryId && item.status === "submitted").map((item) => item.id);
      const reviews = state.validationReviews.filter((item) => assignmentIds.includes(item.assignment_id)).map((row) => ({ id: row.id, assignmentId: row.assignment_id, rubric: row.rubric as Record<string, unknown>, evidenceIds: row.evidence_ids as string[], reason: String(row.reason), confidence: row.confidence as "high" | "medium" | "low" })) as RawCommunityReview[];
      const aggregate = engine === "ai" ? await aggregateCommunityReviewsWithAi(reviews) : aggregateCommunityReviews(reviews);
      state.reviewAggregates.push({ id: crypto.randomUUID(), pool_entry_id: poolEntryId, engine: aggregate.engine, model_version: aggregate.modelVersion, rubric_summary: { summary: aggregate.summary, fields: aggregate.rubricSummary }, disagreement: aggregate.disagreement, raw_review_ids: aggregate.rawReviewIds, status: aggregate.status, created_at: new Date().toISOString() });
      return aggregate;
    });
  }
  const { data: assignments, error: assignmentError } = await admin.from("blind_review_assignments").select("id").eq("pool_entry_id", poolEntryId).eq("status", "submitted");
  if (assignmentError) throw assignmentError;
  const assignmentIds = (assignments ?? []).map((item) => item.id);
  if (!assignmentIds.length) return aggregateCommunityReviews([], engine);
  const { data: rows, error: reviewError } = await admin.from("blind_reviews").select("id,assignment_id,rubric,evidence_ids,reason,confidence").in("assignment_id", assignmentIds).order("submitted_at", { ascending: true });
  if (reviewError) throw reviewError;
  const reviews = (rows ?? []).map((row) => ({ id: row.id, assignmentId: row.assignment_id, rubric: row.rubric as Record<string, unknown>, evidenceIds: Array.isArray(row.evidence_ids) ? row.evidence_ids as string[] : [], reason: row.reason, confidence: row.confidence })) as RawCommunityReview[];
  const aggregate = engine === "ai"
    ? await aggregateCommunityReviewsWithAi(reviews)
    : aggregateCommunityReviews(reviews);
  const { error: insertError } = await admin.from("blind_review_aggregates").insert({ pool_entry_id: poolEntryId, engine: aggregate.engine, model_version: aggregate.modelVersion, rubric_summary: { summary: aggregate.summary, fields: aggregate.rubricSummary }, disagreement: aggregate.disagreement, raw_review_ids: aggregate.rawReviewIds, status: aggregate.status });
  if (insertError) throw insertError;
  return aggregate;
}
