export type TeamMemberRole = "owner" | "coach" | "learner";
export type TeamMemberStatus = "active" | "invited";

export type TeamMember = {
  id: string;
  name: string;
  role: TeamMemberRole;
  status: TeamMemberStatus;
  joinedAt: string;
};

export type TeamWorkspace = {
  id: string;
  name: string;
  inviteCode: string;
  ownerId: string;
  createdAt: string;
  members: TeamMember[];
};

export const TEAM_DIRECTORY_STORAGE_KEY = "product-drill-team-directory-v1";

function randomId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function makeInviteCode(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
}

export function createTeamWorkspace(input: { ownerId: string; ownerName: string; name: string }): TeamWorkspace {
  const now = new Date().toISOString();
  return {
    id: randomId("team"),
    name: input.name.trim(),
    inviteCode: makeInviteCode(),
    ownerId: input.ownerId,
    createdAt: now,
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
      role: input.role ?? "learner",
      status: "active",
      joinedAt: new Date().toISOString()
    }]
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

function isTeamWorkspace(value: unknown): value is TeamWorkspace {
  if (!value || typeof value !== "object") return false;
  const team = value as Partial<TeamWorkspace>;
  return typeof team.id === "string"
    && typeof team.name === "string"
    && typeof team.inviteCode === "string"
    && typeof team.ownerId === "string"
    && typeof team.createdAt === "string"
    && Array.isArray(team.members)
    && team.members.every(isTeamMember);
}

function isTeamMember(value: unknown): value is TeamMember {
  if (!value || typeof value !== "object") return false;
  const member = value as Partial<TeamMember>;
  return typeof member.id === "string"
    && typeof member.name === "string"
    && (member.role === "owner" || member.role === "coach" || member.role === "learner")
    && (member.status === "active" || member.status === "invited")
    && typeof member.joinedAt === "string";
}
