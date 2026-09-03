import { ANALYTICS_EVENTS, scoreBand } from "@/lib/analytics/events";
import { trackServerEvent } from "@/lib/analytics/server";
import { apiError, parseJsonBody, requireApiUser, resolveSessionSnapshot } from "@/lib/api/server";
import { EvaluationBodySchema } from "@/lib/api/schemas";
import { generateStructuredEvaluation } from "@/lib/ai/pipeline";
import { captureServerException } from "@/lib/monitoring/server";
import { getSessionSnapshot, saveHistoryRecord } from "@/lib/repositories/training-repository";
import { consumeModelRateLimit } from "@/lib/security/rate-limit";
import { createTrainingHistoryRecord } from "@/lib/training-history";
import { signTrainingRecord } from "@/lib/training-integrity";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser();
  if (!user) return apiError("请先登录。", 401);
  const { id } = await context.params;
  const parsed = EvaluationBodySchema.safeParse(await parseJsonBody(request));
  if (!parsed.success) return apiError("评估参数无效。", 422, parsed.error.flatten());

  try {
    const stored = await getSessionSnapshot(user.id, id);
    const session = resolveSessionSnapshot({ stored, supplied: parsed.data.session, sessionId: id, allowMissingStored: user.source === "demo" });
    if (!session) return apiError("训练会话不存在或已失效。", 404);
    if (session.stage !== "feedback" || !session.judgment) return apiError("请先提交产品判断。", 409);

    const rateLimit = await consumeModelRateLimit(user, "evaluation");
    if (!rateLimit.allowed) {
      return apiError(
        "请求过于频繁，请稍后重试。",
        429,
        { retryAfterSeconds: rateLimit.retryAfterSeconds }
      );
    }

    const evaluation = await generateStructuredEvaluation(session);
    // FB-014：评分由服务端计算，落库与返回前签名，供客户端校验篡改。
    const record = signTrainingRecord(createTrainingHistoryRecord(session, evaluation));
    const persisted = await saveHistoryRecord(user.id, record);
    if (user.source === "supabase" && !persisted) return apiError("服务端持久化尚未配置。", 503);
    await trackServerEvent(user.id, ANALYTICS_EVENTS.evaluationViewed, {
      scenarioId: record.scenarioId,
      scenarioVersion: record.scenarioVersion,
      rubricVersion: record.rubricVersion,
      modelVersion: record.modelVersion,
      engine: record.engine,
      mode: record.mode,
      scoreBand: scoreBand(record.totalScore)
    });
    return Response.json({ evaluation, record, fallback: evaluation.engine === "deterministic" });
  } catch (error) {
    captureServerException(error, { area: "evaluation", sessionId: id });
    return apiError("评估暂时无法完成，请稍后重试。", 503);
  }
}
