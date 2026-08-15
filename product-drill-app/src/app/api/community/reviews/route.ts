import { z } from "zod";
import { apiError, parseJsonBody, requireApiUser } from "@/lib/api/server";
import { captureServerException } from "@/lib/monitoring/server";
import { getBlindReviewAssignments } from "@/lib/repositories/validation-repository";
import {
  aggregateCommunityReviewRecords,
  assignNextCommunityReviewRecord,
  declareReviewerConflictRecord,
} from "@/lib/repositories/community-review-repository";

const RequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("assign"), cohortId: z.string().uuid() }),
  z.object({ action: z.literal("declare_conflict"), cohortId: z.string().uuid(), conflictGroup: z.string().trim().min(1).max(120) }),
  z.object({ action: z.literal("aggregate"), poolEntryId: z.string().uuid(), engine: z.enum(["ai", "deterministic"]).default("ai") }),
]);

function reviewError(error: unknown) {
  const message = error instanceof Error ? error.message : "Community review request failed";
  if (message === "Review persistence is not configured") return apiError("社区评审服务尚未配置数据库。", 503);
  if (message === "Reviewer participation required") return apiError("当前账号没有该验证批次的评审资格。", 403);
  if (message.startsWith("Review rate limit exceeded")) return apiError("评审操作过于频繁，请稍后再试。", 429);
  if (message === "Admin role required") return apiError("需要管理员权限。", 403);
  return apiError("社区评审操作失败。", 400);
}

export async function GET() {
  const user = await requireApiUser();
  if (!user) return apiError("请先登录。", 401);
  try {
    return Response.json({ assignments: await getBlindReviewAssignments(user.id) });
  } catch (error) {
    captureServerException(error, { area: "community_review_read" });
    return apiError("社区评审任务暂时无法读取。", 503);
  }
}

export async function POST(request: Request) {
  const user = await requireApiUser();
  if (!user) return apiError("请先登录。", 401);
  const parsed = RequestSchema.safeParse(await parseJsonBody(request));
  if (!parsed.success) return apiError("社区评审请求格式不正确。", 400, parsed.error.flatten());
  try {
    if (parsed.data.action === "assign") return Response.json({ assignment: await assignNextCommunityReviewRecord(user.id, parsed.data.cohortId) }, { status: 201 });
    if (parsed.data.action === "declare_conflict") return Response.json({ conflict: await declareReviewerConflictRecord(user.id, parsed.data) }, { status: 201 });
    return Response.json({ aggregate: await aggregateCommunityReviewRecords(user.id, parsed.data.poolEntryId, parsed.data.engine) });
  } catch (error) {
    captureServerException(error, { area: "community_review_write", action: parsed.data.action });
    return reviewError(error);
  }
}
