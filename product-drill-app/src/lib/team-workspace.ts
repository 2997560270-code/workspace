export type TeamMemberRole = "owner" | "coach" | "learner";
export type TeamMemberStatus = "active" | "invited";

export type TeamMember = {
  id: string;
  name: string;
  role: TeamMemberRole;
  status: TeamMemberStatus;
  joinedAt: string;
  /** RT-005：负责人自定义的展示称谓（如「产品总监」）。展示名 ≠ 权限角色，权限仍由 role 决定。 */
  title?: string;
};

export type TeamMentorNote = {
  id: string;
  sessionId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
};

export type TeamWorkspace = {
  id: string;
  name: string;
  inviteCode: string;
  ownerId: string;
  createdAt: string;
  members: TeamMember[];
  /** RT-005：新成员凭邀请码加入时获得的身份（负责人可在邀请区切换）。 */
  inviteRole?: TeamMemberRole;
  /** FB-009/FB-011：负责人/导师以自己账号对成员训练记录留下的点评 */
  mentorNotes?: TeamMentorNote[];
};

export const TEAM_DIRECTORY_STORAGE_KEY = "product-drill-team-directory-v1";

function randomId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function makeInviteCode(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
}

export function createTeamWorkspace(input: { ownerId: string; ownerName: string; name: string; inviteRole?: TeamMemberRole }): TeamWorkspace {
  const now = new Date().toISOString();
  return {
    id: randomId("team"),
    name: input.name.trim(),
    inviteCode: makeInviteCode(),
    ownerId: input.ownerId,
    createdAt: now,
    inviteRole: input.inviteRole ?? "learner",
    members: [{ id: input.ownerId, name: input.ownerName.trim() || "团队负责人", role: "owner", status: "active", joinedAt: now }]
  };
}

export function joinTeamWorkspace(team: TeamWorkspace, input: { memberId: string; memberName: string; role?: TeamMemberRole }): TeamWorkspace {
  if (team.members.some((member) => member.id === input.memberId)) return team;
  return {
    ...team,
    members: [...team.members, {
      id: input.memberId,
      name: input.memberName.trim() || "团队成员",
      // RT-005：身份由负责人在邀请时指定（team.inviteRole），未指定时回退学习者。
      role: input.role ?? team.inviteRole ?? "learner",
      status: "active",
      joinedAt: new Date().toISOString()
    }]
  };
}

/** RT-005：负责人切换邀请身份，之后凭邀请码加入的成员使用该身份。 */
export function setTeamInviteRole(team: TeamWorkspace, callerId: string, inviteRole: TeamMemberRole): TeamWorkspace {
  const caller = team.members.find((item) => item.id === callerId);
  if (!caller || caller.role !== "owner") return team;
  return { ...team, inviteRole };
}

// RT-005：负责人可在 learner/coach 之间调整成员角色；owner 角色不可被改动。
export function setTeamMemberRole(team: TeamWorkspace, memberId: string, role: TeamMemberRole): TeamWorkspace {
  return {
    ...team,
    members: team.members.map((member) =>
      member.id === memberId && member.role !== "owner" ? { ...member, role } : member
    )
  };
}

export type TeamLifecycleCheck = { ok: true } | { ok: false; reason: string };

// RT-008：成员退出 / 负责人解散 / 负责人移除成员。
// 退出与移除都直接删除成员关系（而不是标记 suspended），
// 这样该账号可以凭邀请码重新加入，成员列表也不会留下「待加入」的幽灵成员。
export function canLeaveTeam(team: TeamWorkspace, memberId: string): TeamLifecycleCheck {
  const member = team.members.find((item) => item.id === memberId);
  if (!member) return { ok: false, reason: "你不是这个团队的成员。" };
  // 负责人代表团队本身：还有其他活跃成员时不能一走了之，必须先解散团队。
  if (member.role === "owner" && team.members.some((item) => item.id !== memberId && item.status === "active")) {
    return { ok: false, reason: "负责人需要先解散团队，或先移出其他成员，才能退出。" };
  }
  return { ok: true };
}

/** 退出团队。校验不通过时原样返回；返回 null 表示团队已无成员、应从目录中删除。 */
export function leaveTeamWorkspace(team: TeamWorkspace, memberId: string): TeamWorkspace | null {
  if (!canLeaveTeam(team, memberId).ok) return team;
  const remaining = team.members.filter((item) => item.id !== memberId);
  if (!remaining.length) return null;
  return { ...team, members: remaining };
}

export function canRemoveTeamMember(team: TeamWorkspace, callerId: string, memberId: string): TeamLifecycleCheck {
  const caller = team.members.find((item) => item.id === callerId);
  if (!caller || caller.status !== "active") return { ok: false, reason: "只有团队正式成员可以管理成员。" };
  if (caller.role === "learner") return { ok: false, reason: "只有负责人或导师可以移除成员。" };
  if (callerId === memberId) return { ok: false, reason: "不能移除自己，请使用「退出团队」。" };
  const target = team.members.find((item) => item.id === memberId);
  if (!target) return { ok: false, reason: "这个成员不在团队里。" };
  if (target.role === "owner") return { ok: false, reason: "不能移除团队负责人。" };
  // 越权收敛：导师只能移除学习者，负责人可以移除导师与学习者。
  if (caller.role === "coach" && target.role !== "learner") return { ok: false, reason: "导师只能移除学习者。" };
  return { ok: true };
}

/** 移除成员。校验不通过时原样返回。 */
export function removeTeamMember(team: TeamWorkspace, callerId: string, memberId: string): TeamWorkspace {
  if (!canRemoveTeamMember(team, callerId, memberId).ok) return team;
  return { ...team, members: team.members.filter((item) => item.id !== memberId) };
}

export const TEAM_MEMBER_TITLE_MAX = 20;

export function canSetTeamMemberTitle(team: TeamWorkspace, callerId: string, memberId: string): TeamLifecycleCheck {
  const caller = team.members.find((item) => item.id === callerId);
  if (!caller || caller.status !== "active") return { ok: false, reason: "只有团队正式成员可以设置称谓。" };
  // 反馈人原话是「由创建者提供称谓」，因此收敛到负责人，避免成员互相改头衔。
  if (caller.role !== "owner") return { ok: false, reason: "只有团队负责人可以设置成员称谓。" };
  const target = team.members.find((item) => item.id === memberId);
  if (!target) return { ok: false, reason: "这个成员不在团队里。" };
  if (target.role === "owner") return { ok: false, reason: "负责人本人的称谓由账号名决定。" };
  return { ok: true };
}

/** 设置成员展示称谓。传空字符串表示清除，展示时回退到角色名。 */
export function setTeamMemberTitle(team: TeamWorkspace, callerId: string, memberId: string, title: string): TeamWorkspace {
  if (!canSetTeamMemberTitle(team, callerId, memberId).ok) return team;
  const normalized = title.trim().slice(0, TEAM_MEMBER_TITLE_MAX);
  return {
    ...team,
    members: team.members.map((member) => (member.id === memberId ? { ...member, title: normalized || undefined } : member))
  };
}

export function loadTeamDirectory(): TeamWorkspace[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(TEAM_DIRECTORY_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isTeamWorkspace);
  } catch {
    return [];
  }
}

export function saveTeamDirectory(teams: TeamWorkspace[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TEAM_DIRECTORY_STORAGE_KEY, JSON.stringify(teams));
}

export function findTeamForMember(teams: TeamWorkspace[], memberId: string): TeamWorkspace | undefined {
  return teams.find((team) => team.members.some((member) => member.id === memberId));
}

export function findTeamByInviteCode(teams: TeamWorkspace[], inviteCode: string): TeamWorkspace | undefined {
  const normalized = inviteCode.trim().toUpperCase();
  return teams.find((team) => team.inviteCode === normalized);
}

export function addTeamMentorNote(
  team: TeamWorkspace,
  input: { sessionId: string; authorId: string; authorName: string; content: string }
): TeamWorkspace {
  const note: TeamMentorNote = {
    id: randomId("note"),
    sessionId: input.sessionId,
    authorId: input.authorId,
    authorName: input.authorName.trim() || "团队负责人",
    content: input.content.trim(),
    createdAt: new Date().toISOString()
  };
  return { ...team, mentorNotes: [...(team.mentorNotes ?? []), note] };
}

/** 某条训练记录收到的全部团队点评（新→旧） */
export function findNotesForSession(teams: TeamWorkspace[], sessionId: string): TeamMentorNote[] {
  return teams
    .flatMap((team) => team.mentorNotes ?? [])
    .filter((note) => note.sessionId === sessionId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

function isTeamWorkspace(value: unknown): value is TeamWorkspace {
  if (!value || typeof value !== "object") return false;
  const team = value as Partial<TeamWorkspace>;
  const inviteRoleOk = team.inviteRole === undefined
    || team.inviteRole === "owner" || team.inviteRole === "coach" || team.inviteRole === "learner";
  return typeof team.id === "string"
    && typeof team.name === "string"
    && typeof team.inviteCode === "string"
    && typeof team.ownerId === "string"
    && typeof team.createdAt === "string"
    && inviteRoleOk
    && Array.isArray(team.members)
    && team.members.every(isTeamMember);
}

function isTeamMember(value: unknown): value is TeamMember {
  if (!value || typeof value !== "object") return false;
  const member = value as Partial<TeamMember>;
  const titleOk = member.title === undefined || typeof member.title === "string";
  return typeof member.id === "string"
    && typeof member.name === "string"
    && (member.role === "owner" || member.role === "coach" || member.role === "learner")
    && (member.status === "active" || member.status === "invited")
    && typeof member.joinedAt === "string"
    && titleOk;
}
