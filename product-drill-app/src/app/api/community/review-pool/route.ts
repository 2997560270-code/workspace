import { z } from "zod";
import { apiError, parseJsonBody, requireApiUser } from "@/lib/api/server";
import { captureServerException } from "@/lib/monitoring/server";
import { createReviewPoolEntryRecord } from "@/lib/repositories/community-review-repository";

const PoolEntrySchema = z.object({
  cohortId: z.string().uuid(),
  subjectUserId: z.string().uuid().optional(),
  decisionEventId: z.string().min(1).max(160).optional(),
  anchorCaseId: z.string().uuid().optional(),
  conflictGroup: z.string().trim().min(1).max(120).optional(),
}).refine((value) => Boolean(value.decisionEventId) !== Boolean(value.anchorCaseId), "Exactly one subject reference is required");

export async function POST(request: Request) {
  const user = await requireApiUser();
  if (!user) return apiError("请先登录。", 401);
  const parsed = PoolEntrySchema.safeParse(await parseJsonBody(request));
  if (!parsed.success) return apiError("待评池条目格式不正确。", 400, parsed.error.flatten());
  try {
    return Response.json({ entry: await createReviewPoolEntryRecord(user.id, parsed.data) }, { status: 201 });
  } catch (error) {
    captureServerException(error, { area: "community_review_pool_write" });
    const message = error instanceof Error ? error.message : "";
    if (message === "Review persistence is not configured") return apiError("社区评审服务尚未配置数据库。", 503);
    if (message === "Admin role required") return apiError("需要管理员权限。", 403);
    return apiError("待评池条目创建失败。", 400);
  }
}
