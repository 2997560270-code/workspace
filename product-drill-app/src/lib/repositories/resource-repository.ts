import { createSupabaseAdminClient } from "../supabase/admin";
import { isLocalRuntimeFallbackEnabled, withLocalRuntimeState } from "../local-runtime-store";

export async function getSubscription(userId: string) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    if (!isLocalRuntimeFallbackEnabled()) return null;
    return withLocalRuntimeState((state) => state.subscriptions.find((item) => item.user_id === userId) ?? { plan_id: "free", status: "active", current_period_end: null, provider: null });
  }
  const { data, error } = await admin.from("billing_subscriptions").select("plan_id,status,current_period_end,provider").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data ?? { plan_id: "free", status: "active", current_period_end: null, provider: null };
}

export async function listPublishedCommunityCases() {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    if (!isLocalRuntimeFallbackEnabled()) return [];
    return withLocalRuntimeState((state) => state.communityCases.filter((item) => item.status === "published").sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 100));
  }
  const { data, error } = await admin.from("community_cases").select("id,title,industry,skill_id,summary,lesson,status,created_at").eq("status", "published").order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function submitCommunityCase(userId: string, input: { title: string; industry: string; skillId: string; summary: string; lesson: string }) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    if (!isLocalRuntimeFallbackEnabled()) throw new Error("Content persistence is not configured");
    return withLocalRuntimeState((state) => {
      const now = new Date().toISOString();
      const item = { id: crypto.randomUUID(), author_id: userId, title: input.title.trim(), industry: input.industry.trim(), skill_id: input.skillId, summary: input.summary.trim(), lesson: input.lesson.trim(), status: "pending", reviewed_by: null, reviewed_at: null, created_at: now, updated_at: now };
      state.communityCases.push(item);
      return item;
    });
  }
  const { data, error } = await admin.from("community_cases").insert({ author_id: userId, title: input.title.trim(), industry: input.industry.trim(), skill_id: input.skillId, summary: input.summary.trim(), lesson: input.lesson.trim(), status: "pending" }).select("*").single();
  if (error) throw error;
  return data;
}

export async function searchKnowledgeEntries(query: string) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    if (!isLocalRuntimeFallbackEnabled()) return [];
    const term = query.trim().toLocaleLowerCase().slice(0, 80);
    return withLocalRuntimeState((state) => state.knowledgeEntries.filter((item) => {
      if (item.status !== "published") return false;
      if (!term) return true;
      return [item.title, item.industry, item.content, ...(Array.isArray(item.tags) ? item.tags : [])].some((value) => String(value).toLocaleLowerCase().includes(term));
    }).sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at))).slice(0, 100));
  }
  let request = admin.from("knowledge_entries").select("id,title,industry,tags,content,source").eq("status", "published").limit(100);
  const term = query.trim().replace(/[%_,()]/g, "").slice(0, 80);
  if (term) request = request.or(`title.ilike.%${term}%,industry.ilike.%${term}%,content.ilike.%${term}%`);
  const { data, error } = await request.order("updated_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function moderateCommunityCase(userId: string, caseId: string, status: "published" | "archived" | "rejected") {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    if (!isLocalRuntimeFallbackEnabled()) throw new Error("Content persistence is not configured");
    return withLocalRuntimeState((state) => {
      const item = state.communityCases.find((candidate) => candidate.id === caseId);
      if (!item) throw new Error("Case not found");
      const before = structuredClone(item);
      const reviewedAt = new Date().toISOString();
      item.status = status;
      item.reviewed_by = userId;
      item.reviewed_at = reviewedAt;
      item.updated_at = reviewedAt;
      state.contentAuditLogs.push({ id: crypto.randomUUID(), actor_id: userId, entity_type: "community_case", entity_id: caseId, action: status, before_state: before, after_state: structuredClone(item), created_at: reviewedAt });
      return item;
    });
  }
  const { data: profile, error: roleError } = await admin.from("profiles").select("account_role").eq("id", userId).maybeSingle();
  if (roleError) throw roleError;
  if (profile?.account_role !== "admin") throw new Error("Admin role required");
  const { data: before, error: readError } = await admin.from("community_cases").select("*").eq("id", caseId).maybeSingle();
  if (readError) throw readError;
  if (!before) throw new Error("Case not found");
  const reviewedAt = new Date().toISOString();
  const { data: after, error: updateError } = await admin.from("community_cases").update({ status, reviewed_by: userId, reviewed_at: reviewedAt, updated_at: reviewedAt }).eq("id", caseId).select("*").single();
  if (updateError) throw updateError;
  const { error: auditError } = await admin.from("content_audit_log").insert({ actor_id: userId, entity_type: "community_case", entity_id: caseId, action: status, before_state: before, after_state: after });
  if (auditError) throw auditError;
  return after;
}

export async function moderateKnowledgeEntry(userId: string, entryId: string, status: "published" | "archived") {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    if (!isLocalRuntimeFallbackEnabled()) throw new Error("Content persistence is not configured");
    return withLocalRuntimeState((state) => {
      const item = state.knowledgeEntries.find((candidate) => candidate.id === entryId);
      if (!item) throw new Error("Knowledge entry not found");
      const before = structuredClone(item);
      const reviewedAt = new Date().toISOString();
      item.status = status;
      item.reviewed_by = userId;
      item.updated_at = reviewedAt;
      state.contentAuditLogs.push({ id: crypto.randomUUID(), actor_id: userId, entity_type: "knowledge_entry", entity_id: entryId, action: status, before_state: before, after_state: structuredClone(item), created_at: reviewedAt });
      return item;
    });
  }
  const { data: profile, error: roleError } = await admin.from("profiles").select("account_role").eq("id", userId).maybeSingle();
  if (roleError) throw roleError;
  if (profile?.account_role !== "admin") throw new Error("Admin role required");
  const { data: before, error: readError } = await admin.from("knowledge_entries").select("*").eq("id", entryId).maybeSingle();
  if (readError) throw readError;
  if (!before) throw new Error("Knowledge entry not found");
  const reviewedAt = new Date().toISOString();
  const { data: after, error: updateError } = await admin.from("knowledge_entries").update({ status, reviewed_by: userId, updated_at: reviewedAt }).eq("id", entryId).select("*").single();
  if (updateError) throw updateError;
  const { error: auditError } = await admin.from("content_audit_log").insert({ actor_id: userId, entity_type: "knowledge_entry", entity_id: entryId, action: status, before_state: before, after_state: after });
  if (auditError) throw auditError;
  return after;
}
