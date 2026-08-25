import { z } from "zod";
import { apiError, parseJsonBody, requireApiUser } from "@/lib/api/server";
import { captureServerException } from "@/lib/monitoring/server";
import { answerMultiRoleQuestion, MULTI_ROLE_SCENARIOS } from "@/lib/multi-role-training";
import { appendMultiRoleExchange, createMultiRoleSession, getLatestMultiRoleSession, getMultiRoleSession } from "@/lib/repositories/multi-role-repository";

const StartSchema = z.object({
  action: z.literal("start"),
  scenarioId: z.string().trim().min(1).max(120),
  roleId: z.string().trim().min(1).max(120),
  resume: z.boolean().default(true),
});
const MessageSchema = z.object({
  action: z.literal("message"),
  sessionId: z.string().uuid(),
  content: z.string().trim().min(1).max(2000),
});
const ActionSchema = z.discriminatedUnion("action", [StartSchema, MessageSchema]);

function findRole(scenarioId: string, roleId: string) {
  const scenario = MULTI_ROLE_SCENARIOS.find((item) => item.id === scenarioId);
  return { scenario, role: scenario?.roles.find((item) => item.id === roleId) };
}

export async function GET(request: Request) {
  const user = await requireApiUser();
  if (!user) return apiError("请先登录。", 401);
  const sessionId = new URL(request.url).searchParams.get("sessionId");
  if (!sessionId || !z.string().uuid().safeParse(sessionId).success) return apiError("会话编号不正确。", 400);
  try {
    const session = await getMultiRoleSession(user.id, sessionId);
    return session ? Response.json({ session }) : apiError("会话不存在。", 404);
  } catch (error) {
    captureServerException(error, { area: "multi_role_read" });
    return apiError("多人角色会话暂时无法读取。", 503);
  }
}

export async function POST(request: Request) {
  const user = await requireApiUser();
  if (!user) return apiError("请先登录。", 401);
  const parsed = ActionSchema.safeParse(await parseJsonBody(request));
  if (!parsed.success) return apiError("多人角色请求格式不正确。", 400, parsed.error.flatten());
  try {
    if (parsed.data.action === "start") {
      const { scenario, role } = findRole(parsed.data.scenarioId, parsed.data.roleId);
      if (!scenario || !role) return apiError("场景或角色不存在。", 404);
      const existing = parsed.data.resume
        ? await getLatestMultiRoleSession(user.id, scenario.id, role.id)
        : null;
      const session = existing ?? await createMultiRoleSession({ userId: user.id, scenarioId: scenario.id, roleId: role.id, opening: role.opening });
      return Response.json({ session, resumed: Boolean(existing), configured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) }, { status: existing ? 200 : 201 });
    }

    const current = await getMultiRoleSession(user.id, parsed.data.sessionId);
    if (!current) return apiError("会话不存在。", 404);
    const { role } = findRole(current.scenario_id, current.role_id);
    if (!role) return apiError("会话角色配置已失效。", 409);
    const reply = answerMultiRoleQuestion(role, parsed.data.content);
    const session = await appendMultiRoleExchange({ userId: user.id, sessionId: current.id, question: parsed.data.content, reply });
    return Response.json({ session });
  } catch (error) {
    captureServerException(error, { area: "multi_role_write", action: parsed.data.action });
    return apiError("多人角色会话操作失败。", 503);
  }
}
