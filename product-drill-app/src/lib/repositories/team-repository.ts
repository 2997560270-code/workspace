import { createSupabaseAdminClient } from "../supabase/admin";
import { isLocalRuntimeFallbackEnabled, withLocalRuntimeState } from "../local-runtime-store";
import { getHistoryRecords } from "./training-repository";

export type TeamRow = {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
  team_members?: Array<{ user_id: string; role: "owner" | "coach" | "learner"; status: "active" | "invited" | "suspended"; joined_at: string }>;
};

function localTeamRow(state: { teams: Array<Record<string, unknown>>; teamMembers: Array<Record<string, unknown>> }, teamId: string): TeamRow | null {
  const team = state.teams.find((item) => item.id === teamId);
  if (!team) return null;
  const members = state.teamMembers
    .filter((item) => item.team_id === teamId)
    .map((item) => ({ user_id: String(item.user_id), role: item.role as "owner" | "coach" | "learner", status: item.status as "active" | "invited" | "suspended", joined_at: String(item.joined_at) }));
  return { id: String(team.id), name: String(team.name), owner_id: String(team.owner_id), created_at: String(team.created_at), updated_at: String(team.updated_at), team_members: members };
}

function localActiveMember(state: { teamMembers: Array<Record<string, unknown>> }, teamId: string, userId: string) {
  return state.teamMembers.find((item) => item.team_id === teamId && item.user_id === userId && item.status === "active");
}

export async function getTeamForUser(userId: string): Promise<TeamRow | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    if (!isLocalRuntimeFallbackEnabled()) return null;
    return withLocalRuntimeState((state) => {
      const membership = state.teamMembers.find((item) => item.user_id === userId && item.status === "active");
      return membership ? localTeamRow(state, String(membership.team_id)) : null;
    });
  }
  const { data: memberships, error: membershipError } = await admin.from("team_members").select("team_id").eq("user_id", userId).eq("status", "active").limit(1);
  if (membershipError) throw membershipError;
  const teamId = memberships?.[0]?.team_id;
  if (!teamId) return null;
  const { data, error } = await admin.from("teams").select("*, team_members(user_id, role, status, joined_at)").eq("id", teamId).maybeSingle();
  if (error) throw error;
  return data as TeamRow | null;
}

export async function createTeamWithOwner(userId: string, name: string): Promise<TeamRow> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    if (!isLocalRuntimeFallbackEnabled()) throw new Error("Team persistence is not configured");
    return withLocalRuntimeState((state) => {
      const now = new Date().toISOString();
      const team = { id: crypto.randomUUID(), name: name.trim(), owner_id: userId, created_at: now, updated_at: now };
      state.teams.push(team);
      state.teamMembers.push({ team_id: team.id, user_id: userId, role: "owner", status: "active", joined_at: now });
      return localTeamRow(state, team.id)!;
    });
  }
  const { data: team, error: teamError } = await admin.from("teams").insert({ name: name.trim(), owner_id: userId }).select("*").single();
  if (teamError) throw teamError;
  const { error: memberError } = await admin.from("team_members").insert({ team_id: team.id, user_id: userId, role: "owner", status: "active" });
  if (memberError) throw memberError;
  return { ...(team as TeamRow), team_members: [{ user_id: userId, role: "owner", status: "active", joined_at: new Date().toISOString() }] };
}

export async function createTeamInvitation(userId: string, teamId: string, role: "coach" | "learner" = "learner") {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    if (!isLocalRuntimeFallbackEnabled()) throw new Error("Team persistence is not configured");
    return withLocalRuntimeState((state) => {
      if (!localActiveMember(state, teamId, userId) || !["owner", "coach"].includes(String(localActiveMember(state, teamId, userId)?.role))) throw new Error("Team manager permission required");
      if (!state.teams.some((item) => item.id === teamId)) throw new Error("Team not found");
      const invitation = { id: crypto.randomUUID(), team_id: teamId, code: crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase(), role, created_by: userId, expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), accepted_by: null, accepted_at: null, created_at: new Date().toISOString() };
      state.teamInvitations.push(invitation);
      return invitation;
    });
  }
  const { data: membership, error: membershipError } = await admin.from("team_members").select("role,status").eq("team_id", teamId).eq("user_id", userId).eq("status", "active").maybeSingle();
  if (membershipError) throw membershipError;
  if (!membership || !["owner", "coach"].includes(membership.role)) throw new Error("Team manager permission required");
  const code = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  const { data, error } = await admin.from("team_invitations").insert({ team_id: teamId, code, role, created_by: userId, expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() }).select("*").single();
  if (error) throw error;
  return data;
}

export async function joinTeamByInvitation(userId: string, code: string): Promise<TeamRow> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    if (!isLocalRuntimeFallbackEnabled()) throw new Error("Team persistence is not configured");
    return withLocalRuntimeState((state) => {
      const invitation = state.teamInvitations.find((item) => item.code === code.trim().toUpperCase() && !item.accepted_at && new Date(String(item.expires_at)).getTime() > Date.now());
      if (!invitation) throw new Error("邀请码无效或已过期");
      state.teamMembers = state.teamMembers.filter((item) => !(item.team_id === invitation.team_id && item.user_id === userId));
      state.teamMembers.push({ team_id: invitation.team_id, user_id: userId, role: invitation.role, status: "active", joined_at: new Date().toISOString() });
      invitation.accepted_by = userId;
      invitation.accepted_at = new Date().toISOString();
      const team = localTeamRow(state, String(invitation.team_id));
      if (!team) throw new Error("加入团队后读取团队失败");
      return team;
    });
  }
  const { data: invitation, error: invitationError } = await admin.from("team_invitations").select("*").eq("code", code.trim().toUpperCase()).is("accepted_at", null).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (invitationError) throw invitationError;
  if (!invitation) throw new Error("邀请码无效或已过期");
  const { error: memberError } = await admin.from("team_members").upsert({ team_id: invitation.team_id, user_id: userId, role: invitation.role, status: "active" });
  if (memberError) throw memberError;
  const { error: acceptError } = await admin.from("team_invitations").update({ accepted_by: userId, accepted_at: new Date().toISOString() }).eq("id", invitation.id);
  if (acceptError) throw acceptError;
  const team = await getTeamForUser(userId);
  if (!team) throw new Error("加入团队后读取团队失败");
  return team;
}

export async function saveMentorNote(input: { userId: string; teamId: string; sessionId: string; content: string }) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    if (!isLocalRuntimeFallbackEnabled()) throw new Error("Team persistence is not configured");
    return withLocalRuntimeState((state) => {
      const member = localActiveMember(state, input.teamId, input.userId);
      if (!member || !["owner", "coach"].includes(String(member.role))) throw new Error("Team manager permission required");
      const note = { id: crypto.randomUUID(), team_id: input.teamId, session_id: input.sessionId, author_id: input.userId, content: input.content.trim(), created_at: new Date().toISOString() };
      state.mentorNotes.push(note);
      return note;
    });
  }
  const { data: membership, error: membershipError } = await admin.from("team_members").select("role,status").eq("team_id", input.teamId).eq("user_id", input.userId).eq("status", "active").maybeSingle();
  if (membershipError) throw membershipError;
  if (!membership || !["owner", "coach"].includes(membership.role)) throw new Error("Team manager permission required");
  const { data, error } = await admin.from("mentor_notes").insert({ team_id: input.teamId, session_id: input.sessionId, author_id: input.userId, content: input.content.trim() }).select("*").single();
  if (error) throw error;
  return data;
}

// RT-005：负责人可在 learner/coach 之间调整成员角色（owner 角色不可被改动）。
export async function setTeamMemberRole(userId: string, teamId: string, memberId: string, role: "coach" | "learner"): Promise<TeamRow> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    if (!isLocalRuntimeFallbackEnabled()) throw new Error("Team persistence is not configured");
    return withLocalRuntimeState((state) => {
      const caller = localActiveMember(state, teamId, userId);
      if (!caller || caller.role !== "owner") throw new Error("Only team owner can change roles");
      const target = state.teamMembers.find((item) => item.team_id === teamId && String(item.user_id) === memberId);
      if (!target || String(target.role) === "owner") throw new Error("Owner role cannot be changed");
      state.teamMembers = state.teamMembers.map((item) =>
        item.team_id === teamId && String(item.user_id) === memberId ? { ...item, role } : item
      );
      const team = localTeamRow(state, teamId);
      if (!team) throw new Error("Team not found");
      return team;
    });
  }
  const { data: membership, error: membershipError } = await admin.from("team_members").select("role").eq("team_id", teamId).eq("user_id", userId).eq("status", "active").maybeSingle();
  if (membershipError) throw membershipError;
  if (!membership || membership.role !== "owner") throw new Error("Only team owner can change roles");
  const { data: target, error: targetError } = await admin.from("team_members").select("role").eq("team_id", teamId).eq("user_id", memberId).maybeSingle();
  if (targetError) throw targetError;
  if (!target || target.role === "owner") throw new Error("Owner role cannot be changed");
  const { error: updateError } = await admin.from("team_members").update({ role }).eq("team_id", teamId).eq("user_id", memberId);
  if (updateError) throw updateError;
  const team = await getTeamForUser(userId);
  if (!team) throw new Error("Team not found");
  return team;
}

// FB-009：负责人/导师查看某成员的训练概况（仅同团队、且调用者为 owner/coach 才可读）。
export async function listMemberRecords(
  callerUserId: string,
  teamId: string,
  memberUserId: string
): Promise<Array<{ id: string; scenarioId: string; title: string; mode: string; totalScore: number; completedAt: string }>> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    if (!isLocalRuntimeFallbackEnabled()) return [];
    return withLocalRuntimeState((state) => {
      const caller = localActiveMember(state, teamId, callerUserId);
      if (!caller || !["owner", "coach"].includes(String(caller.role))) throw new Error("Team manager permission required");
      if (!state.teamMembers.some((item) => item.team_id === teamId && String(item.user_id) === memberUserId)) throw new Error("Member not in team");
      return [];
    });
  }
  const { data: callerMembership, error: callerError } = await admin.from("team_members").select("role").eq("team_id", teamId).eq("user_id", callerUserId).eq("status", "active").maybeSingle();
  if (callerError) throw callerError;
  if (!callerMembership || !["owner", "coach"].includes(callerMembership.role)) throw new Error("Team manager permission required");
  const { data: memberMembership, error: memberError } = await admin.from("team_members").select("user_id").eq("team_id", teamId).eq("user_id", memberUserId).eq("status", "active").maybeSingle();
  if (memberError) throw memberError;
  if (!memberMembership) throw new Error("Member not in team");
  const records = await getHistoryRecords(memberUserId);
  return records.map((record) => ({
    id: record.id,
    scenarioId: record.scenarioId,
    title: record.scenarioSnapshot?.shortTitle ?? record.scenarioId,
    mode: record.mode,
    totalScore: record.totalScore,
    completedAt: record.completedAt,
  }));
}

export async function listMentorNotesForSession(userId: string, sessionId: string) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    if (!isLocalRuntimeFallbackEnabled()) return [];
    return withLocalRuntimeState((state) => {
      const memberships = new Set(state.teamMembers.filter((item) => item.user_id === userId && item.status === "active").map((item) => String(item.team_id)));
      return state.mentorNotes.filter((item) => item.session_id === sessionId && memberships.has(String(item.team_id))).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    });
  }
  const { data: memberships, error: membershipError } = await admin.from("team_members").select("team_id").eq("user_id", userId).eq("status", "active");
  if (membershipError) throw membershipError;
  const teamIds = (memberships ?? []).map((item) => item.team_id);
  if (!teamIds.length) return [];
  const { data, error } = await admin.from("mentor_notes").select("id,team_id,session_id,author_id,content,created_at").eq("session_id", sessionId).in("team_id", teamIds).order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
