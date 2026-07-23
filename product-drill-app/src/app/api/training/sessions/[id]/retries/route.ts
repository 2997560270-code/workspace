import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { trackServerEvent } from "@/lib/analytics/server";
import { apiError, parseJsonBody, requireApiUser, validateHistoryForPath } from "@/lib/api/server";
import { RetryBodySchema, TrainingHistoryRecordSchema } from "@/lib/api/schemas";
import { evaluateRetryTurn } from "@/lib/ai/pipeline";
import { captureServerException } from "@/lib/monitoring/server";
import { getHistoryRecord, saveHistoryRecord } from "@/lib/repositories/training-repository";
import { consumeModelRateLimit } from "@/lib/security/rate-limit";
import { addRetryToHistory, type RetryResult } from "@/lib/training-history";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser();
  if (!user) return apiError("请先登录。", 401);
  const { id } = await context.params;
  const parsed = RetryBodySchema.safeParse(await parseJsonBody(request));
  if (!parsed.success) return apiError("复练参数无效。", 422, parsed.error.flatten());

  try {
    const stored = await getHistoryRecord(user.id, id);
    const storedResult = TrainingHistoryRecordSchema.safeParse(stored);
    const record = storedResult.success && storedResult.data.sessionId === id
      ? storedResult.data
      : user.source === "demo" ? validateHistoryForPath(parsed.data.record, id) : null;
    if (!record) return apiError("训练记录不存在或已失效。", 404);
    const issue = record.evaluation.issues.find((item) => item.id === parsed.data.issueId);
    if (!issue) return apiError("复练目标不存在。", 404);

    const rateLimit = await consumeModelRateLimit(user, "retry");
    if (!rateLimit.allowed) {
      return apiError(
        "请求过于频繁，请稍后重试。",
        429,
        { retryAfterSeconds: rateLimit.retryAfterSeconds }
      );
    }

    const result = await evaluateRetryTurn({
      targetSkill: issue.targetSkill,
      originalIssue: issue.description,
      retryPrompt: issue.retryPrompt,
      answer: parsed.data.answer
    });
    const retry: RetryResult = {
      id: `retry-${crypto.randomUUID()}`,
      issueId: issue.id,
      targetSkill: issue.targetSkill,
      answer: parsed.data.answer,
      improved: result.improved,
      feedback: result.feedback,
      engine: result.engine,
      modelVersion: result.modelVersion
    };
    const nextRecord = addRetryToHistory(record, retry);
    const persisted = await saveHistoryRecord(user.id, nextRecord);
    if (user.source === "supabase" && !persisted) return apiError("服务端持久化尚未配置。", 503);
    await trackServerEvent(user.id, ANALYTICS_EVENTS.retryCompleted, {
      scenarioId: record.scenarioId,
      scenarioVersion: record.scenarioVersion,
      rubricVersion: record.rubricVersion,
      modelVersion: retry.modelVersion,
      engine: retry.engine,
      mode: record.mode,
      targetSkill: retry.targetSkill,
      improved: retry.improved
    });
    if (retry.improved) {
      await trackServerEvent(user.id, ANALYTICS_EVENTS.improvementRecorded, {
        scenarioId: record.scenarioId,
        scenarioVersion: record.scenarioVersion,
        rubricVersion: record.rubricVersion,
        modelVersion: retry.modelVersion,
        engine: retry.engine,
        mode: record.mode,
        targetSkill: retry.targetSkill,
        improved: true
      });
    }
    return Response.json({ retry, record: nextRecord, fallback: retry.engine === "deterministic" });
  } catch (error) {
    captureServerException(error, { area: "retry", sessionId: id });
    return apiError("复练暂时无法评估，请稍后重试。", 503);
  }
}
