import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { trackServerEvent } from "@/lib/analytics/server";
import { apiError, parseJsonBody, requireApiUser, resolveSessionSnapshot } from "@/lib/api/server";
import { MessageBodySchema } from "@/lib/api/schemas";
import { generateRoleplayTurn } from "@/lib/ai/pipeline";
import { captureServerException } from "@/lib/monitoring/server";
import { getSessionSnapshot, saveSessionSnapshot } from "@/lib/repositories/training-repository";
import { consumeModelRateLimit } from "@/lib/security/rate-limit";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser();
  if (!user) return apiError("请先登录。", 401);
  const { id } = await context.params;

  const parsed = MessageBodySchema.safeParse(await parseJsonBody(request));
  if (!parsed.success) return apiError("追问内容无效。", 422, parsed.error.flatten());

  try {
    const stored = await getSessionSnapshot(user.id, id);
    const session = resolveSessionSnapshot({ stored, supplied: parsed.data.session, sessionId: id, allowMissingStored: user.source === "demo" });
    if (!session) return apiError("训练会话不存在或已失效。", 404);
    if (session.stage !== "interview") return apiError("当前阶段不能继续追问。", 409);

    const rateLimit = await consumeModelRateLimit(user, "roleplay");
    if (!rateLimit.allowed) {
      return apiError(
        "请求过于频繁，请稍后重试。",
        429,
        { retryAfterSeconds: rateLimit.retryAfterSeconds }
      );
    }

    const nextSession = await generateRoleplayTurn(session, parsed.data.content);
    const persisted = await saveSessionSnapshot(user.id, nextSession);
    if (user.source === "supabase" && !persisted) return apiError("服务端持久化尚未配置。", 503);
    await trackServerEvent(user.id, ANALYTICS_EVENTS.trainingMessageSent, {
      scenarioId: nextSession.scenarioId,
      scenarioVersion: nextSession.scenarioVersion,
      rubricVersion: nextSession.rubricVersion,
      modelVersion: nextSession.modelVersion,
      engine: nextSession.engine,
      mode: nextSession.mode
    });
    return Response.json({ session: nextSession, fallback: nextSession.engine === "deterministic" });
  } catch (error) {
    captureServerException(error, { area: "training_message", sessionId: id });
    return apiError("AI 用户暂时无法回应，请稍后重试。", 503);
  }
}
