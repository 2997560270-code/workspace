import { createSupabaseAdminClient } from "../supabase/admin";
import { isLocalRuntimeFallbackEnabled, withLocalRuntimeState } from "../local-runtime-store";

async function assertAdmin(userId: string) {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Validation persistence is not configured");
  const { data, error } = await admin.from("profiles").select("account_role").eq("id", userId).maybeSingle();
  if (error) throw error;
  if (data?.account_role !== "admin") throw new Error("Admin role required");
  return admin;
}

export async function createValidationCohortRecord(userId: string, name: string) {
  const inviteCode = crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
  const admin = createSupabaseAdminClient();
  if (!admin) {
    if (!isLocalRuntimeFallbackEnabled()) throw new Error("Validation persistence is not configured");
    return withLocalRuntimeState((state) => {
      const now = new Date().toISOString();
      const cohort = { id: crypto.randomUUID(), name: name.trim(), invite_code: inviteCode, status: "recruiting", created_by: userId, created_at: now, updated_at: now };
      state.validationCohorts.push(cohort);
      state.validationParticipants.push({ cohort_id: cohort.id, user_id: userId, participant_role: "researcher", status: "active", consent_version: "creator", consented_at: now, joined_at: now });
      return cohort;
    });
  }
  await assertAdmin(userId);
  const { data, error } = await admin.from("validation_cohorts").insert({ name: name.trim(), invite_code: inviteCode, status: "recruiting", created_by: userId }).select("*").single();
  if (error) throw error;
  const { error: participantError } = await admin.from("validation_participants").upsert({ cohort_id: data.id, user_id: userId, participant_role: "researcher", status: "active", consent_version: "creator", consented_at: new Date().toISOString() });
  if (participantError) throw participantError;
  return data;
}

export async function joinValidationCohortRecord(userId: string, code: string, role: "target_user" | "pm_reviewer" | "hiring_reviewer" | "researcher", consentVersion: string) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    if (!isLocalRuntimeFallbackEnabled()) throw new Error("Validation persistence is not configured");
    return withLocalRuntimeState((state) => {
      const cohort = state.validationCohorts.find((item) => item.invite_code === code.trim().toUpperCase() && ["recruiting", "active"].includes(String(item.status)));
      if (!cohort) throw new Error("Validation invite is invalid");
      const now = new Date().toISOString();
      const participant = { cohort_id: cohort.id, user_id: userId, participant_role: role, status: "active", consent_version: consentVersion, consented_at: now, joined_at: now };
      state.validationParticipants = state.validationParticipants.filter((item) => item.cohort_id !== cohort.id || item.user_id !== userId);
      state.validationParticipants.push(participant);
      return participant;
    });
  }
  const { data: cohort, error: cohortError } = await admin.from("validation_cohorts").select("id,status").eq("invite_code", code.trim().toUpperCase()).in("status", ["recruiting", "active"]).maybeSingle();
  if (cohortError) throw cohortError;
  if (!cohort) throw new Error("Validation invite is invalid");
  const now = new Date().toISOString();
  const { data, error } = await admin.from("validation_participants").upsert({ cohort_id: cohort.id, user_id: userId, participant_role: role, status: "active", consent_version: consentVersion, consented_at: now }).select("*").single();
  if (error) throw error;
  return data;
}

export async function getValidationCohortsForUser(userId: string) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    if (!isLocalRuntimeFallbackEnabled()) return [];
    return withLocalRuntimeState((state) => state.validationParticipants
      .filter((item) => item.user_id === userId)
      .sort((a, b) => String(b.joined_at).localeCompare(String(a.joined_at)))
      .map((participant) => ({
        ...participant,
        validation_cohorts: state.validationCohorts.find((cohort) => cohort.id === participant.cohort_id) ?? null,
      })));
  }
  const { data, error } = await admin
    .from("validation_participants")
    .select("cohort_id,participant_role,status,consent_version,consented_at,joined_at,validation_cohorts(id,name,invite_code,status,starts_at,ends_at,created_at)")
    .eq("user_id", userId)
    .order("joined_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getBlindReviewAssignments(userId: string) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    if (!isLocalRuntimeFallbackEnabled()) return [];
    return withLocalRuntimeState((state) => state.validationAssignments.filter((item) => item.reviewer_id === userId && ["assigned", "opened"].includes(String(item.status))).map(({ decision_event_id: _decision, anchor_case_id: _anchor, reviewer_id: _reviewer, ...item }) => item).sort((a, b) => String(a.assigned_at).localeCompare(String(b.assigned_at))));
  }
  const { data, error } = await admin.from("blind_review_assignments").select("id,cohort_id,anonymized_subject_id,status,conflict_declared,assigned_at,due_at").eq("reviewer_id", userId).in("status", ["assigned", "opened"]).order("assigned_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function openBlindReviewAssignment(userId: string, assignmentId: string) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    if (!isLocalRuntimeFallbackEnabled()) throw new Error("Validation persistence is not configured");
    return withLocalRuntimeState((state) => {
      const assignment = state.validationAssignments.find((item) => item.id === assignmentId && item.reviewer_id === userId && item.status === "assigned");
      if (!assignment) throw new Error("Review assignment is not available");
      assignment.status = "opened";
      const { decision_event_id: _decision, anchor_case_id: _anchor, reviewer_id: _reviewer, ...safe } = assignment;
      return safe;
    });
  }
  const { data, error } = await admin
    .from("blind_review_assignments")
    .update({ status: "opened" })
    .eq("id", assignmentId)
    .eq("reviewer_id", userId)
    .eq("status", "assigned")
    .select("id,cohort_id,anonymized_subject_id,status,conflict_declared,assigned_at,due_at")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Review assignment is not available");
  return data;
}

export async function declareBlindReviewConflict(userId: string, assignmentId: string) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    if (!isLocalRuntimeFallbackEnabled()) throw new Error("Validation persistence is not configured");
    return withLocalRuntimeState((state) => {
      const assignment = state.validationAssignments.find((item) => item.id === assignmentId && item.reviewer_id === userId && ["assigned", "opened"].includes(String(item.status)));
      if (!assignment) throw new Error("Review assignment is not available");
      assignment.conflict_declared = true;
      assignment.status = "expired";
      return { id: assignment.id, status: assignment.status, conflict_declared: true };
    });
  }
  const { data, error } = await admin
    .from("blind_review_assignments")
    .update({ conflict_declared: true, status: "expired" })
    .eq("id", assignmentId)
    .eq("reviewer_id", userId)
    .in("status", ["assigned", "opened"])
    .select("id,status,conflict_declared")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Review assignment is not available");
  return data;
}

export async function submitBlindReviewRecord(userId: string, input: { assignmentId: string; rubric: Record<string, unknown>; evidenceIds: string[]; reason: string; confidence: "high" | "medium" | "low"; conflictDeclared: boolean }) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    if (!isLocalRuntimeFallbackEnabled()) throw new Error("Validation persistence is not configured");
    return withLocalRuntimeState((state) => {
      const assignment = state.validationAssignments.find((item) => item.id === input.assignmentId && item.reviewer_id === userId && ["assigned", "opened"].includes(String(item.status)));
      if (!assignment) throw new Error("Review assignment is not available");
      if (input.conflictDeclared) {
        assignment.conflict_declared = true;
        assignment.status = "expired";
        return { conflictDeclared: true };
      }
      if (state.validationReviews.some((item) => item.assignment_id === input.assignmentId)) throw new Error("Review assignment is not available");
      const review = { id: crypto.randomUUID(), assignment_id: input.assignmentId, reviewer_id: userId, rubric: input.rubric, evidence_ids: input.evidenceIds, reason: input.reason.trim(), confidence: input.confidence, submitted_at: new Date().toISOString() };
      state.validationReviews.push(review);
      assignment.status = "submitted";
      return review;
    });
  }
  const { data: assignment, error: assignmentError } = await admin.from("blind_review_assignments").select("id,status,reviewer_id").eq("id", input.assignmentId).eq("reviewer_id", userId).maybeSingle();
  if (assignmentError) throw assignmentError;
  if (!assignment || !["assigned", "opened"].includes(assignment.status)) throw new Error("Review assignment is not available");
  if (input.conflictDeclared) {
    const { error } = await admin.from("blind_review_assignments").update({ conflict_declared: true, status: "expired" }).eq("id", input.assignmentId).eq("reviewer_id", userId);
    if (error) throw error;
    return { conflictDeclared: true };
  }
  const { data: review, error: reviewError } = await admin.from("blind_reviews").insert({ assignment_id: input.assignmentId, reviewer_id: userId, rubric: input.rubric, evidence_ids: input.evidenceIds, reason: input.reason.trim(), confidence: input.confidence }).select("*").single();
  if (reviewError) throw reviewError;
  const { error: statusError } = await admin.from("blind_review_assignments").update({ status: "submitted" }).eq("id", input.assignmentId).eq("reviewer_id", userId);
  if (statusError) throw statusError;
  return review;
}

export async function recordValidationMeasurement(userId: string, input: { cohortId: string; participantId: string; metricType: "repeatability" | "user_understanding" | "provisional_transfer" | "reviewer_agreement"; value: number; metadata?: Record<string, unknown> }) {
  const directAdmin = createSupabaseAdminClient();
  if (!directAdmin) {
    if (!isLocalRuntimeFallbackEnabled()) throw new Error("Validation persistence is not configured");
    return withLocalRuntimeState((state) => {
      const cohort = state.validationCohorts.find((item) => item.id === input.cohortId && item.created_by === userId);
      if (!cohort) throw new Error("Admin role required");
      const measurement = { id: crypto.randomUUID(), cohort_id: input.cohortId, participant_id: input.participantId, metric_type: input.metricType, value: input.value, metadata: input.metadata ?? {}, measured_at: new Date().toISOString() };
      state.validationMeasurements.push(measurement);
      return measurement;
    });
  }
  const admin = await assertAdmin(userId);
  const { data, error } = await admin.from("validation_measurements").insert({ cohort_id: input.cohortId, participant_id: input.participantId, metric_type: input.metricType, value: input.value, metadata: input.metadata ?? {} }).select("*").single();
  if (error) throw error;
  return data;
}
