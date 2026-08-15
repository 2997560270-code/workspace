import { z } from "zod";
import { apiError, parseJsonBody, requireApiUser } from "@/lib/api/server";
import { captureServerException } from "@/lib/monitoring/server";
import {
  declareBlindReviewConflict,
  getBlindReviewAssignments,
  openBlindReviewAssignment,
  submitBlindReviewRecord,
} from "@/lib/repositories/validation-repository";

const AssignmentSchema = z.object({ assignmentId: z.string().uuid() });
const ReviewSchema = z.object({
  assignmentId: z.string().uuid(),
  conflictDeclared: z.literal(false).default(false),
  rubric: z.record(z.string(), z.unknown()).refine((value) => Object.keys(value).length > 0, "Rubric cannot be empty"),
  evidenceIds: z.array(z.string().min(1).max(160)).max(100),
  reason: z.string().trim().min(20).max(4000),
  confidence: z.enum(["high", "medium", "low"]),
});
const ConflictSchema = z.object({ assignmentId: z.string().uuid(), conflictDeclared: z.literal(true) });

function reviewError(error: unknown) {
  const message = error instanceof Error ? error.message : "Review request failed";
  if (message === "Validation persistence is not configured") return apiError("验证服务尚未配置数据库。", 503);
  if (message === "Review assignment is not available") return apiError("该盲评任务不可用或已提交。", 409);
  return apiError("盲评操作失败。", 400);
}

export async function GET() {
  const user = await requireApiUser();
  if (!user) return apiError("请先登录。", 401);
  try {
    return Response.json({ assignments: await getBlindReviewAssignments(user.id) });
  } catch (error) {
    captureServerException(error, { area: "validation_review_read" });
    return apiError("盲评任务暂时无法读取。", 503);
  }
}

export async function PATCH(request: Request) {
  const user = await requireApiUser();
  if (!user) return apiError("请先登录。", 401);
  const parsed = AssignmentSchema.safeParse(await parseJsonBody(request));
  if (!parsed.success) return apiError("盲评任务请求格式不正确。", 400, parsed.error.flatten());
  try {
    return Response.json({ assignment: await openBlindReviewAssignment(user.id, parsed.data.assignmentId) });
  } catch (error) {
    captureServerException(error, { area: "validation_review_open" });
    return reviewError(error);
  }
}

export async function POST(request: Request) {
  const user = await requireApiUser();
  if (!user) return apiError("请先登录。", 401);
  const body = await parseJsonBody(request);
  const conflict = ConflictSchema.safeParse(body);
  const review = ReviewSchema.safeParse(body);
  if (!conflict.success && !review.success) return apiError("盲评请求格式不正确。", 400, review.error.flatten());
  try {
    if (conflict.success) {
      return Response.json({ conflict: await declareBlindReviewConflict(user.id, conflict.data.assignmentId) });
    }
    if (!review.success) return apiError("盲评请求格式不正确。", 400, review.error.flatten());
    return Response.json({ review: await submitBlindReviewRecord(user.id, review.data) }, { status: 201 });
  } catch (error) {
    captureServerException(error, { area: "validation_review_write" });
    return reviewError(error);
  }
}
