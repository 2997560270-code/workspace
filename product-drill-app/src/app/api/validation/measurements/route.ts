import { z } from "zod";
import { apiError, parseJsonBody, requireApiUser } from "@/lib/api/server";
import { captureServerException } from "@/lib/monitoring/server";
import { recordValidationMeasurement } from "@/lib/repositories/validation-repository";

const MeasurementSchema = z.object({
  cohortId: z.string().uuid(),
  participantId: z.string().uuid(),
  metricType: z.enum(["repeatability", "user_understanding", "provisional_transfer", "reviewer_agreement"]),
  value: z.number().finite(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request) {
  const user = await requireApiUser();
  if (!user) return apiError("请先登录。", 401);
  const parsed = MeasurementSchema.safeParse(await parseJsonBody(request));
  if (!parsed.success) return apiError("基线测量格式不正确。", 400, parsed.error.flatten());
  try {
    return Response.json({ measurement: await recordValidationMeasurement(user.id, parsed.data) }, { status: 201 });
  } catch (error) {
    captureServerException(error, { area: "validation_measurement_write" });
    const message = error instanceof Error ? error.message : "";
    if (message === "Admin role required") return apiError("需要管理员权限。", 403);
    if (message === "Validation persistence is not configured") return apiError("验证服务尚未配置数据库。", 503);
    return apiError("基线测量写入失败。", 400);
  }
}
