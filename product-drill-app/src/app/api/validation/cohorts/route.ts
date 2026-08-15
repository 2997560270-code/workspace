import { z } from "zod";
import { apiError, parseJsonBody, requireApiUser } from "@/lib/api/server";
import { captureServerException } from "@/lib/monitoring/server";
import {
  createValidationCohortRecord,
  getValidationCohortsForUser,
  joinValidationCohortRecord,
} from "@/lib/repositories/validation-repository";

const CohortRequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), name: z.string().trim().min(2).max(160) }),
  z.object({
    action: z.literal("join"),
    code: z.string().trim().regex(/^[A-Z0-9]{10}$/i),
    role: z.enum(["target_user", "pm_reviewer", "hiring_reviewer", "researcher"]),
    consentVersion: z.string().trim().min(1).max(80),
  }),
]);

function validationError(error: unknown) {
  const message = error instanceof Error ? error.message : "Validation request failed";
  if (message === "Admin role required") return apiError("需要管理员权限。", 403);
  if (message === "Validation persistence is not configured") return apiError("验证服务尚未配置数据库。", 503);
  if (message === "Validation invite is invalid") return apiError("邀请码无效或已关闭。", 400);
  return apiError("验证批次操作失败。", 400);
}

export async function GET() {
  const user = await requireApiUser();
  if (!user) return apiError("请先登录。", 401);
  try {
    return Response.json({ cohorts: await getValidationCohortsForUser(user.id) });
  } catch (error) {
    captureServerException(error, { area: "validation_cohort_read" });
    return apiError("验证批次暂时无法读取。", 503);
  }
}

export async function POST(request: Request) {
  const user = await requireApiUser();
  if (!user) return apiError("请先登录。", 401);
  const parsed = CohortRequestSchema.safeParse(await parseJsonBody(request));
  if (!parsed.success) return apiError("验证批次请求格式不正确。", 400, parsed.error.flatten());
  try {
    if (parsed.data.action === "create") {
      return Response.json({ cohort: await createValidationCohortRecord(user.id, parsed.data.name) }, { status: 201 });
    }
    return Response.json({ participant: await joinValidationCohortRecord(user.id, parsed.data.code, parsed.data.role, parsed.data.consentVersion) }, { status: 201 });
  } catch (error) {
    captureServerException(error, { area: "validation_cohort_write", action: parsed.data.action });
    return validationError(error);
  }
}
