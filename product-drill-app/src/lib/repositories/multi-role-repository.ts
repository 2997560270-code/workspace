import { isLocalRuntimeFallbackEnabled, withLocalRuntimeState } from "../local-runtime-store";
import { createSupabaseAdminClient } from "../supabase/admin";

export type MultiRoleMessageRow = {
  id: string;
  session_id: string;
  author: "user" | "role";
  content: string;
  created_at: string;
};

export type MultiRoleSessionRow = {
  id: string;
  user_id: string;
  scenario_id: string;
  role_id: string;
  status: "active" | "closed";
  created_at: string;
  updated_at: string;
  messages: MultiRoleMessageRow[];
};

function localSession(
  state: { multiRoleSessions: Array<Record<string, unknown>>; multiRoleMessages: Array<Record<string, unknown>> },
  sessionId: string,
): MultiRoleSessionRow | null {
  const session = state.multiRoleSessions.find((item) => item.id === sessionId);
  if (!session) return null;
  const messages = state.multiRoleMessages
    .filter((item) => item.session_id === sessionId)
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))) as MultiRoleMessageRow[];
  return { ...(session as Omit<MultiRoleSessionRow, "messages">), messages };
}

async function loadSupabaseSession(sessionId: string, userId: string): Promise<MultiRoleSessionRow | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const { data: session, error: sessionError } = await admin
    .from("multi_role_sessions")
    .select("id,user_id,scenario_id,role_id,status,created_at,updated_at")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (sessionError) throw sessionError;
  if (!session) return null;
  const { data: messages, error: messageError } = await admin
    .from("multi_role_messages")
    .select("id,session_id,author,content,created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (messageError) throw messageError;
  return { ...session, messages: (messages ?? []) as MultiRoleMessageRow[] } as MultiRoleSessionRow;
}

export async function getLatestMultiRoleSession(userId: string, scenarioId: string, roleId: string) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    if (!isLocalRuntimeFallbackEnabled()) return null;
    return withLocalRuntimeState((state) => {
      const latest = state.multiRoleSessions
        .filter((item) => item.user_id === userId && item.scenario_id === scenarioId && item.role_id === roleId && item.status === "active")
        .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))[0];
      return latest ? localSession(state, String(latest.id)) : null;
    });
  }
  const { data, error } = await admin
    .from("multi_role_sessions")
    .select("id")
    .eq("user_id", userId)
    .eq("scenario_id", scenarioId)
    .eq("role_id", roleId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? loadSupabaseSession(data.id, userId) : null;
}

export async function createMultiRoleSession(input: {
  userId: string;
  scenarioId: string;
  roleId: string;
  opening: string;
}) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    if (!isLocalRuntimeFallbackEnabled()) throw new Error("Multi-role persistence is not configured");
    return withLocalRuntimeState((state) => {
      const now = new Date().toISOString();
      const session = {
        id: crypto.randomUUID(), user_id: input.userId, scenario_id: input.scenarioId,
        role_id: input.roleId, status: "active", created_at: now, updated_at: now,
      };
      const opening = { id: crypto.randomUUID(), session_id: session.id, author: "role", content: input.opening, created_at: now };
      state.multiRoleSessions.push(session);
      state.multiRoleMessages.push(opening);
      return localSession(state, session.id)!;
    });
  }
  const { data: session, error: sessionError } = await admin
    .from("multi_role_sessions")
    .insert({ user_id: input.userId, scenario_id: input.scenarioId, role_id: input.roleId })
    .select("id,user_id,scenario_id,role_id,status,created_at,updated_at")
    .single();
  if (sessionError) throw sessionError;
  const { error: messageError } = await admin
    .from("multi_role_messages")
    .insert({ session_id: session.id, author: "role", content: input.opening });
  if (messageError) {
    await admin.from("multi_role_sessions").delete().eq("id", session.id);
    throw messageError;
  }
  return loadSupabaseSession(session.id, input.userId) as Promise<MultiRoleSessionRow>;
}

export async function appendMultiRoleExchange(input: {
  userId: string;
  sessionId: string;
  question: string;
  reply: string;
}) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    if (!isLocalRuntimeFallbackEnabled()) throw new Error("Multi-role persistence is not configured");
    return withLocalRuntimeState((state) => {
      const session = state.multiRoleSessions.find((item) => item.id === input.sessionId && item.user_id === input.userId && item.status === "active");
      if (!session) throw new Error("Multi-role session not found");
      const now = new Date().toISOString();
      state.multiRoleMessages.push(
        { id: crypto.randomUUID(), session_id: input.sessionId, author: "user", content: input.question, created_at: now },
        { id: crypto.randomUUID(), session_id: input.sessionId, author: "role", content: input.reply, created_at: new Date(Date.now() + 1).toISOString() },
      );
      session.updated_at = new Date().toISOString();
      return localSession(state, input.sessionId)!;
    });
  }
  const current = await loadSupabaseSession(input.sessionId, input.userId);
  if (!current || current.status !== "active") throw new Error("Multi-role session not found");
  const { error: messageError } = await admin.from("multi_role_messages").insert([
    { session_id: input.sessionId, author: "user", content: input.question },
    { session_id: input.sessionId, author: "role", content: input.reply },
  ]);
  if (messageError) throw messageError;
  const { error: updateError } = await admin.from("multi_role_sessions").update({ updated_at: new Date().toISOString() }).eq("id", input.sessionId).eq("user_id", input.userId);
  if (updateError) throw updateError;
  return loadSupabaseSession(input.sessionId, input.userId) as Promise<MultiRoleSessionRow>;
}

export async function getMultiRoleSession(userId: string, sessionId: string) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    if (!isLocalRuntimeFallbackEnabled()) return null;
    return withLocalRuntimeState((state) => {
      const session = localSession(state, sessionId);
      return session?.user_id === userId ? session : null;
    });
  }
  return loadSupabaseSession(sessionId, userId);
}
