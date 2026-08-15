import { createSupabaseAdminClient } from "../supabase/admin";
import { appendVerifiedProcessEvent, buildVerifiedReport, clearHumanReview, completeVerifiedSession, recordEnvironment, recordManualIdentity, startVerifiedSession, type VerifiedProcessEvent, type VerifiedSession } from "../verified-pilot";
import { isLocalRuntimeFallbackEnabled, withLocalRuntimeState } from "../local-runtime-store";

async function requireAdmin(userId: string) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    if (!isLocalRuntimeFallbackEnabled()) throw new Error("Verified pilot persistence is not configured");
    return null;
  }
  const { data, error } = await admin.from("profiles").select("account_role").eq("id", userId).maybeSingle();
  if (error) throw error;
  if (data?.account_role !== "admin") throw new Error("Admin role required");
  return admin;
}

async function getSession(admin: ReturnType<typeof createSupabaseAdminClient>, sessionId: string) {
  if (!admin) {
    if (!isLocalRuntimeFallbackEnabled()) throw new Error("Verified pilot persistence is not configured");
    return withLocalRuntimeState((state) => {
      const row = state.verifiedSessions.find((item) => item.id === sessionId);
      if (!row) throw new Error("Verified session is not available");
      const events = state.verifiedEvents.filter((item) => item.session_id === sessionId).sort((a, b) => String(a.occurred_at).localeCompare(String(b.occurred_at)));
      return { row, domain: { id: `verified-${row.id}`, organizationId: String(row.organization_id), assessmentRunId: String(row.assessment_run_id), participantId: String(row.participant_id), identityStatus: row.identity_status, environmentStatus: row.environment_status, processStatus: row.process_status, humanReviewStatus: row.human_review_status, consentVersion: String(row.consent_version), events: events.map((event) => ({ type: event.event_type, payload: event.payload as Record<string, unknown>, occurredAt: String(event.occurred_at) })) } as VerifiedSession };
    });
  }
  const { data, error } = await admin.from("verified_assessment_sessions").select("id,organization_id,assessment_run_id,participant_id,identity_status,environment_status,process_status,human_review_status,consent_version").eq("id", sessionId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Verified session is not available");
  const { data: events, error: eventError } = await admin.from("verified_process_events").select("event_type,payload,occurred_at").eq("session_id", sessionId).order("occurred_at", { ascending: true });
  if (eventError) throw eventError;
  return { row: data, domain: { id: `verified-${data.id}`, organizationId: data.organization_id, assessmentRunId: data.assessment_run_id, participantId: data.participant_id, identityStatus: data.identity_status, environmentStatus: data.environment_status, processStatus: data.process_status, humanReviewStatus: data.human_review_status, consentVersion: data.consent_version, events: (events ?? []).map((event) => ({ type: event.event_type, payload: event.payload as Record<string, unknown>, occurredAt: event.occurred_at })) } as VerifiedSession };
}

async function persistSession(admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, session: VerifiedSession) {
  const sessionId = session.id.replace(/^verified-/, "");
  const { data, error } = await admin.from("verified_assessment_sessions").update({ identity_status: session.identityStatus, environment_status: session.environmentStatus, process_status: session.processStatus, human_review_status: session.humanReviewStatus, completed_at: session.processStatus === "completed" ? new Date().toISOString() : null }).eq("id", sessionId).select("id,organization_id,assessment_run_id,participant_id,identity_status,environment_status,process_status,human_review_status,consent_version").single();
  if (error) throw error;
  return data;
}

async function persistLocalSession(session: VerifiedSession) {
  return withLocalRuntimeState((state) => {
    const id = session.id.replace(/^verified-/, "");
    const row = state.verifiedSessions.find((item) => item.id === id);
    if (!row) throw new Error("Verified session is not available");
    row.identity_status = session.identityStatus;
    row.environment_status = session.environmentStatus;
    row.process_status = session.processStatus;
    row.human_review_status = session.humanReviewStatus;
    row.completed_at = session.processStatus === "completed" ? new Date().toISOString() : null;
    return row;
  });
}

async function appendEvents(admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, session: VerifiedSession, previousCount: number) {
  const newEvents = session.events.slice(previousCount);
  if (!newEvents.length) return;
  const { error } = await admin.from("verified_process_events").insert(newEvents.map((event) => ({ session_id: session.id.replace(/^verified-/, ""), event_type: event.type, payload: event.payload, occurred_at: event.occurredAt })));
  if (error) throw error;
}

async function appendLocalEvents(session: VerifiedSession, previousCount: number) {
  return withLocalRuntimeState((state) => {
    const sessionId = session.id.replace(/^verified-/, "");
    state.verifiedEvents.push(...session.events.slice(previousCount).map((event) => ({ id: crypto.randomUUID(), session_id: sessionId, event_type: event.type, payload: event.payload, occurred_at: event.occurredAt })));
  });
}

export async function createVerifiedOrganizationRecord(userId: string, name: string) {
  const admin = await requireAdmin(userId);
  if (!admin) {
    return withLocalRuntimeState((state) => {
      const organization = { id: crypto.randomUUID(), name: name.trim(), status: "pending", approved_by: null, approved_at: null, created_at: new Date().toISOString() };
      state.organizations.push(organization);
      return organization;
    });
  }
  const { data, error } = await admin.from("verified_organizations").insert({ name: name.trim(), status: "pending" }).select("id,name,status,created_at").single();
  if (error) throw error;
  return data;
}

export async function approveVerifiedOrganizationRecord(userId: string, organizationId: string, status: "approved" | "suspended" | "closed") {
  const admin = await requireAdmin(userId);
  if (!admin) {
    return withLocalRuntimeState((state) => {
      const organization = state.organizations.find((item) => item.id === organizationId);
      if (!organization) throw new Error("Verified organization is not available");
      organization.status = status;
      organization.approved_by = status === "approved" ? userId : null;
      organization.approved_at = status === "approved" ? new Date().toISOString() : null;
      return organization;
    });
  }
  const { data, error } = await admin.from("verified_organizations").update({ status, approved_by: status === "approved" ? userId : null, approved_at: status === "approved" ? new Date().toISOString() : null }).eq("id", organizationId).select("id,name,status,approved_by,approved_at").single();
  if (error) throw error;
  return data;
}

export async function startVerifiedSessionRecord(userId: string, input: { organizationId: string; assessmentRunId: string; consentVersion: string }) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    if (!isLocalRuntimeFallbackEnabled()) throw new Error("Verified pilot persistence is not configured");
    return withLocalRuntimeState((state) => {
      const org = state.organizations.find((item) => item.id === input.organizationId);
      const run = state.assessmentRuns.find((item) => item.id === input.assessmentRunId && item.user_id === userId);
      if (!org) throw new Error("Verified organization is not available");
      if (!run) throw new Error("Assessment run is not available");
      const session = startVerifiedSession({ organization: { id: String(org.id), name: String(org.name), status: org.status as "pending" | "approved" | "suspended" | "closed" }, assessmentRunId: String(run.id), participantId: userId, consentVersion: input.consentVersion, runSubmitted: run.status === "submitted" });
      const id = session.id.replace(/^verified-/, "");
      const row = { id, organization_id: session.organizationId, assessment_run_id: session.assessmentRunId, participant_id: session.participantId, identity_status: session.identityStatus, environment_status: session.environmentStatus, process_status: session.processStatus, human_review_status: session.humanReviewStatus, consent_version: session.consentVersion, started_at: new Date().toISOString(), completed_at: null };
      state.verifiedSessions.push(row);
      return row;
    });
  }
  const { data: org, error: orgError } = await admin.from("verified_organizations").select("id,name,status").eq("id", input.organizationId).maybeSingle();
  if (orgError) throw orgError;
  if (!org) throw new Error("Verified organization is not available");
  const { data: run, error: runError } = await admin.from("assessment_runs").select("id,status,user_id").eq("id", input.assessmentRunId).eq("user_id", userId).maybeSingle();
  if (runError) throw runError;
  if (!run) throw new Error("Assessment run is not available");
  const session = startVerifiedSession({ organization: org, assessmentRunId: run.id, participantId: userId, consentVersion: input.consentVersion, runSubmitted: run.status === "submitted" });
  const sessionId = session.id.replace(/^verified-/, "");
  const { data, error } = await admin.from("verified_assessment_sessions").insert({ id: sessionId, organization_id: session.organizationId, assessment_run_id: session.assessmentRunId, participant_id: session.participantId, identity_status: session.identityStatus, environment_status: session.environmentStatus, process_status: session.processStatus, human_review_status: session.humanReviewStatus, consent_version: session.consentVersion }).select("id,organization_id,assessment_run_id,participant_id,identity_status,environment_status,process_status,human_review_status,consent_version,started_at").single();
  if (error) throw error;
  return data;
}

export async function recordVerifiedIdentityRecord(userId: string, sessionId: string, status: "verified" | "failed" | "waived") {
  const admin = await requireAdmin(userId);
  const current = await getSession(admin, sessionId);
  const next = recordManualIdentity(current.domain, status, userId);
  if (!admin) {
    await appendLocalEvents(next, current.domain.events.length);
    return persistLocalSession(next);
  }
  await appendEvents(admin, next, current.domain.events.length);
  return persistSession(admin, next);
}

export async function recordVerifiedEnvironmentRecord(userId: string, sessionId: string, environment: { browser: string; operatingSystem: string; timezone: string; policyVersion: string }) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    if (!isLocalRuntimeFallbackEnabled()) throw new Error("Verified pilot persistence is not configured");
  }
  const current = await getSession(admin, sessionId);
  if (current.domain.participantId !== userId) throw new Error("Verified session belongs to another user");
  const next = recordEnvironment(current.domain, environment);
  if (!admin) {
    await appendLocalEvents(next, current.domain.events.length);
    return persistLocalSession(next);
  }
  await appendEvents(admin, next, current.domain.events.length);
  return persistSession(admin, next);
}

export async function appendVerifiedEventRecord(userId: string, sessionId: string, event: Omit<VerifiedProcessEvent, "occurredAt">) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    if (!isLocalRuntimeFallbackEnabled()) throw new Error("Verified pilot persistence is not configured");
  }
  const current = await getSession(admin, sessionId);
  if (current.domain.participantId !== userId) throw new Error("Verified session belongs to another user");
  const next = appendVerifiedProcessEvent(current.domain, event);
  if (!admin) {
    await appendLocalEvents(next, current.domain.events.length);
    return persistLocalSession(next);
  }
  await appendEvents(admin, next, current.domain.events.length);
  return persistSession(admin, next);
}

export async function completeVerifiedSessionRecord(userId: string, sessionId: string) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    if (!isLocalRuntimeFallbackEnabled()) throw new Error("Verified pilot persistence is not configured");
  }
  const current = await getSession(admin, sessionId);
  if (current.domain.participantId !== userId) throw new Error("Verified session belongs to another user");
  const next = completeVerifiedSession(current.domain);
  if (!admin) {
    await appendLocalEvents(next, current.domain.events.length);
    return persistLocalSession(next);
  }
  await appendEvents(admin, next, current.domain.events.length);
  return persistSession(admin, next);
}

export async function reviewVerifiedSessionRecord(userId: string, sessionId: string, decision: "cleared" | "flagged", notes?: string) {
  const admin = await requireAdmin(userId);
  const current = await getSession(admin, sessionId);
  const next = clearHumanReview(current.domain, userId, decision);
  if (!admin) {
    await appendLocalEvents(next, current.domain.events.length);
    const result = await persistLocalSession(next);
    await withLocalRuntimeState((state) => { state.humanReviewCases.push({ id: crypto.randomUUID(), session_id: sessionId, reviewer_id: userId, reason: notes?.trim() || "人工复核结果", decision, notes: notes?.trim() || null, created_at: new Date().toISOString(), resolved_at: new Date().toISOString() }); });
    return result;
  }
  await appendEvents(admin, next, current.domain.events.length);
  const result = await persistSession(admin, next);
  const { error } = await admin.from("verified_human_review_cases").insert({ session_id: sessionId, reviewer_id: userId, reason: notes?.trim() || "人工复核结果", decision, notes: notes?.trim() || null, resolved_at: new Date().toISOString() });
  if (error) throw error;
  return result;
}

export async function createVerifiedReportRecord(userId: string, sessionId: string, score: number) {
  const admin = await requireAdmin(userId);
  const current = await getSession(admin, sessionId);
  const report = buildVerifiedReport(current.domain, score);
  if (!admin) {
    return withLocalRuntimeState((state) => {
      const row = { id: crypto.randomUUID(), session_id: sessionId, judgment_level: report.judgmentLevel, confidence_interval: report.confidenceInterval, limitations: report.limitations, usage_status: report.usageStatus, created_at: new Date().toISOString() };
      state.verifiedReports = state.verifiedReports.filter((item) => item.session_id !== sessionId);
      state.verifiedReports.push(row);
      return row;
    });
  }
  const { data, error } = await admin.from("verified_assessment_reports").upsert({ session_id: sessionId, judgment_level: report.judgmentLevel, confidence_interval: report.confidenceInterval, limitations: report.limitations, usage_status: report.usageStatus }).select("id,session_id,judgment_level,confidence_interval,limitations,usage_status,created_at").single();
  if (error) throw error;
  return data;
}
