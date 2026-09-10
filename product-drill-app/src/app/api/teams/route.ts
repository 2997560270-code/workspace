import { z } from "zod";
import { apiError, parseJsonBody, requireApiUser } from "@/lib/api/server";
import { captureServerException } from "@/lib/monitoring/server";
import { createTeamInvitation, createTeamWithOwner, dissolveTeam, getTeamForUser, joinTeamByInvitation, leaveTeam, listMemberRecords, listMentorNotesForSession, removeTeamMember, saveMentorNote, setTeamMemberRole, setTeamMemberTitle } from "@/lib/repositories/team-repository";

const TeamActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), name: z.string().trim().min(2).max(120) }),
  z.object({ action: z.literal("invite"), teamId: z.string().uuid(), role: z.enum(["coach", "learner"]).default("learner") }),
  z.object({ action: z.literal("join"), code: z.string().trim().regex(/^[A-Z0-9]{4,16}$/) }),
  z.object({ action: z.literal("mentor_note"), teamId: z.string().uuid(), sessionId: z.string().trim().min(1).max(160), content: z.string().trim().min(4).max(4000) }),
  z.object({ action: z.literal("set_role"), teamId: z.string().uuid(), memberId: z.string().uuid(), role: z.enum(["coach", "learner"]) }),
  // RT-008：团队生命周期——成员退出、负责人移除成员、负责人解散团队。
  z.object({ action: z.literal("leave"), teamId: z.string().uuid().optional() }),
  z.object({ action: z.literal("remove"), teamId: z.string().uuid(), memberId: z.string().uuid() }),
  z.object({ action: z.literal("dissolve"), teamId: z.string().uuid().optional() }),
  // RT-005：负责人自定义成员称谓（展示名，最多 20 字；空串表示清除）。
  z.object({ action: z.literal("set_title"), teamId: z.string().uuid(), memberId: z.string().uuid(), title: z.string().trim().max(20) }),
]);

export async function GET(request?: Request) {
  const user = await requireApiUser();
  if (!user) return apiError("请先登录。", 401);
  try {
    const url = request ? new URL(request.url) : null;
    const sessionId = url?.searchParams.get("sessionId") ?? null;
    const memberId = url?.searchParams.get("memberId") ?? null;
    const teamId = url?.searchParams.get("teamId") ?? null;
    if (sessionId) {
      return Response.json({ team: await getTeamForUser(user.id), mentorNotes: await listMentorNotesForSession(user.id, sessionId), configured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) });
    }
    if (memberId && teamId) {
      return Response.json({ records: await listMemberRecords(user.id, teamId, memberId) });
    }
    return Response.json({ team: await getTeamForUser(user.id), configured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) });
  } catch (error) {
    captureServerException(error, { area: "team_read" });
    return apiError("团队信息暂时无法读取。", 503);
  }
}

export async function POST(request: Request) {
  const user = await requireApiUser();
  if (!user) return apiError("请先登录。", 401);
  const parsed = TeamActionSchema.safeParse(await parseJsonBody(request));
  if (!parsed.success) return apiError("团队请求格式不正确。", 400, parsed.error.flatten());
  try {
    if (parsed.data.action === "create") {
      return Response.json({ team: await createTeamWithOwner(user.id, parsed.data.name) }, { status: 201 });
    }
    if (parsed.data.action === "join") {
      return Response.json({ team: await joinTeamByInvitation(user.id, parsed.data.code) });
    }
    if (parsed.data.action === "mentor_note") {
      return Response.json({ note: await saveMentorNote({ userId: user.id, teamId: parsed.data.teamId, sessionId: parsed.data.sessionId, content: parsed.data.content }) }, { status: 201 });
    }
    if (parsed.data.action === "set_role") {
      return Response.json({ team: await setTeamMemberRole(user.id, parsed.data.teamId, parsed.data.memberId, parsed.data.role) });
    }
    // RT-008：退出 / 移除 / 解散
    if (parsed.data.action === "leave") {
      return Response.json(await leaveTeam(user.id, parsed.data.teamId));
    }
    if (parsed.data.action === "remove") {
      return Response.json({ team: await removeTeamMember(user.id, parsed.data.teamId, parsed.data.memberId) });
    }
    if (parsed.data.action === "dissolve") {
      return Response.json(await dissolveTeam(user.id, parsed.data.teamId));
    }
    // RT-005：自定义成员称谓
    if (parsed.data.action === "set_title") {
      return Response.json({ team: await setTeamMemberTitle(user.id, parsed.data.teamId, parsed.data.memberId, parsed.data.title) });
    }
    return Response.json({ invitation: await createTeamInvitation(user.id, parsed.data.teamId, parsed.data.role) }, { status: 201 });
  } catch (error) {
    captureServerException(error, { area: "team_write", action: parsed.data.action });
    return apiError("团队操作失败，请检查权限或邀请码。", 400);
  }
}
