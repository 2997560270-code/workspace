import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { trackServerEvent } from "@/lib/analytics/server";
import { apiError, parseJsonBody, requireApiUser, resolveSessionSnapshot } from "@/lib/api/server";
import { JudgmentBodySchema } from "@/lib/api/schemas";
import { captureServerException } from "@/lib/monitoring/server";
import { getSessionSnapshot, saveSessionSnapshot } from "@/lib/repositories/training-repository";
import { moveToJudgment, submitJudgment } from "@/lib/training-session";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser();
  if (!user) return apiError("请先登录。", 401);
  const { id } = await context.params;
  const parsed = JudgmentBodySchema.safeParse(await parseJsonBody(request));
  if (!parsed.success) return apiError("产品判断内容无效。", 422, parsed.error.flatten());

  try {
    const stored = await getSessionSnapshot(user.id, id);
    const session = resolveSessionSnapshot({ stored, supplied: parsed.data.session, sessionId: id, allowMissingStored: user.source === "demo" });
    if (!session) return apiError("训练会话不存在或已失效。", 404);
    const readySession = session.stage === "interview" && session.messages.some((message) => message.role === "user")
      ? moveToJudgment(session)
      : session;
    if (readySession.stage !== "judgment") return apiError("当前阶段不能提交产品判断。", 409);

    const nextSession = submitJudgment(readySession, parsed.data.judgment);
    const persisted = await saveSessionSnapshot(user.id, nextSession);
    if (user.source === "supabase" && !persisted) return apiError("服务端持久化尚未配置。", 503);
    await trackServerEvent(user.id, ANALYTICS_EVENTS.judgmentSubmitted, {
      scenarioId: nextSession.scenarioId,
      scenarioVersion: nextSession.scenarioVersion,
      rubricVersion: nextSession.rubricVersion,
      modelVersion: nextSession.modelVersion,
      engine: nextSession.engine,
      mode: nextSession.mode
    });
    return Response.json({ session: nextSession });
  } catch (error) {
    captureServerException(error, { area: "submit_judgment", sessionId: id });
    return apiError("产品判断暂时无法保存，请稍后重试。", 503);
  }
}
