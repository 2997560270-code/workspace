import { apiError, canSyncClientHistory, parseJsonBody, requireApiUser } from "@/lib/api/server";
import { HistorySyncBodySchema } from "@/lib/api/schemas";
import { captureServerException } from "@/lib/monitoring/server";
import { getHistoryRecords, saveHistoryRecord } from "@/lib/repositories/training-repository";
import { verifyTrainingRecord } from "@/lib/training-integrity";

export async function GET() {
  const user = await requireApiUser();
  if (!user) return apiError("请先登录。", 401);
  try {
    return Response.json({ records: await getHistoryRecords(user.id) });
  } catch (error) {
    captureServerException(error, { area: "history_list" });
    return apiError("训练记录暂时无法读取。", 503);
  }
}

export async function POST(request: Request) {
  const user = await requireApiUser();
  if (!user) return apiError("请先登录。", 401);
  if (!canSyncClientHistory(user.source)) return apiError("正式账号不接受客户端历史记录同步。", 403);
  const parsed = HistorySyncBodySchema.safeParse(await parseJsonBody(request));
  if (!parsed.success) return apiError("训练记录格式无效。", 422, parsed.error.flatten());
  if (parsed.data.record.engine !== "deterministic") return apiError("仅允许同步本地降级训练记录。", 403);
  // FB-014：带有服务端签名的记录一旦校验失败，说明已被篡改，拒绝接收。
  if (parsed.data.record.integrity && !verifyTrainingRecord(parsed.data.record)) {
    return apiError("训练记录完整性校验失败，不接受被篡改的评分。", 422);
  }
  try {
    const persisted = await saveHistoryRecord(user.id, parsed.data.record);
    if (user.source === "supabase" && !persisted) return apiError("服务端持久化尚未配置。", 503);
    return Response.json({ record: parsed.data.record });
  } catch (error) {
    captureServerException(error, { area: "history_sync", sessionId: parsed.data.record.sessionId });
    return apiError("训练记录暂时无法同步。", 503);
  }
}
