import { apiError, parseJsonBody, requireApiUser } from "@/lib/api/server";
import { HistoryVerifyBodySchema } from "@/lib/api/schemas";
import { captureServerException } from "@/lib/monitoring/server";
import { verifyTrainingRecord } from "@/lib/training-integrity";

// FB-014：评分完整性校验只能由服务端完成（签名密钥不下发前端）。
// 客户端加载本地记录后，把带签名的记录提交到这里验证是否被篡改。
export async function POST(request: Request) {
  const user = await requireApiUser();
  if (!user) return apiError("请先登录。", 401);
  const parsed = HistoryVerifyBodySchema.safeParse(await parseJsonBody(request));
  if (!parsed.success) return apiError("校验参数无效。", 422, parsed.error.flatten());
  try {
    const results = parsed.data.records.map((record) => ({
      id: record.id,
      signed: Boolean(record.integrity?.signature),
      valid: record.integrity?.signature ? verifyTrainingRecord(record) : false
    }));
    return Response.json({ results });
  } catch (error) {
    captureServerException(error, { area: "history_verify" });
    return apiError("完整性校验暂时不可用。", 503);
  }
}
