import { z } from "zod";
import { apiError, parseJsonBody, requireApiUser } from "@/lib/api/server";
import { captureServerException } from "@/lib/monitoring/server";
import { createAssessmentBlueprintRecord, createAssessmentReportRecord, getAssessmentReportRecord, listAssessmentBlueprintsRecord, recordAssessmentEvaluationRecord, recordAssessmentFairnessMetricRecord, startAssessmentRunRecord, submitAssessmentResponseRecord } from "@/lib/repositories/standardized-assessment-repository";

const ItemSchema = z.object({ itemKey: z.string().trim().min(1).max(160), poolKind: z.enum(["assessment", "anchor"]), stage: z.enum(["independent_judgment", "ai_work_sample", "anchor_check"]), prompt: z.string().trim().min(1).max(10000), rubric: z.record(z.string(), z.unknown()), weight: z.number().positive().finite() });
const RequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create_blueprint"), roleKey: z.string().trim().min(2).max(120), version: z.string().trim().min(1).max(80), rubricVersion: z.string().trim().min(1).max(80), items: z.array(ItemSchema).min(1).max(100) }),
  z.object({ action: z.literal("start"), blueprintId: z.string().uuid(), mode: z.enum(["pilot", "verified"]).default("pilot") }),
  z.object({ action: z.literal("respond"), runId: z.string().uuid(), itemKey: z.string().trim().min(1).max(160), response: z.record(z.string(), z.unknown()) }),
  z.object({ action: z.literal("report"), runId: z.string().uuid() }),
  z.object({ action: z.literal("evaluate"), runId: z.string().uuid(), itemKey: z.string().trim().min(1).max(160), evaluatorType: z.enum(["human", "ai", "deterministic"]), score: z.number().min(0).max(1), evidence: z.record(z.string(), z.unknown()).optional(), confidence: z.number().min(0).max(1) }),
  z.object({ action: z.literal("fairness_metric"), blueprintId: z.string().uuid(), cohortLabel: z.string().trim().min(1).max(120), sampleSize: z.number().int().nonnegative(), meanScore: z.number().min(0).max(1).optional(), completionRate: z.number().min(0).max(1).optional(), adverseDifference: z.number().min(-1).max(1).optional(), metadata: z.record(z.string(), z.unknown()).optional() }),
]);

function assessmentError(error: unknown) {
  const message = error instanceof Error ? error.message : "Assessment request failed";
  if (message === "Assessment persistence is not configured") return apiError("标准化考核服务尚未配置数据库。", 503);
  if (message === "Admin role required") return apiError("需要管理员权限。", 403);
  if (message === "Assessment blueprint is not available") return apiError("考核蓝图当前不可用。", 409);
  if (message === "Assessment run is not available") return apiError("考核运行不存在或不属于当前用户。", 404);
  if (/fixed order|already answered|not accepting/.test(message)) return apiError("考核必须按固定顺序完成，且该题不能重复提交。", 409);
  if (message === "Assessment run is not ready for reporting") return apiError("考核尚未完成，暂时不能生成报告。", 409);
  return apiError("标准化考核操作失败。", 400);
}

export async function GET(request: Request) {
  const user = await requireApiUser();
  if (!user) return apiError("请先登录。", 401);
  try {
    const runId = new URL(request.url).searchParams.get("runId");
    return runId ? Response.json({ report: await getAssessmentReportRecord(user.id, runId) }) : Response.json({ blueprints: await listAssessmentBlueprintsRecord() });
  } catch (error) {
    captureServerException(error, { area: "assessment_read" });
    return apiError("考核蓝图暂时无法读取。", 503);
  }
}

export async function POST(request: Request) {
  const user = await requireApiUser();
  if (!user) return apiError("请先登录。", 401);
  const parsed = RequestSchema.safeParse(await parseJsonBody(request));
  if (!parsed.success) return apiError("标准化考核请求格式不正确。", 400, parsed.error.flatten());
  try {
    switch (parsed.data.action) {
      case "create_blueprint": return Response.json({ blueprint: await createAssessmentBlueprintRecord(user.id, parsed.data) }, { status: 201 });
      case "start": return Response.json({ run: await startAssessmentRunRecord(user.id, parsed.data.blueprintId, parsed.data.mode) }, { status: 201 });
      case "respond": return Response.json({ run: await submitAssessmentResponseRecord(user.id, parsed.data.runId, parsed.data) });
      case "report": return Response.json({ report: await createAssessmentReportRecord(user.id, parsed.data.runId) }, { status: 201 });
      case "evaluate": return Response.json({ evaluation: await recordAssessmentEvaluationRecord(user.id, parsed.data) }, { status: 201 });
      case "fairness_metric": return Response.json({ metric: await recordAssessmentFairnessMetricRecord(user.id, parsed.data) }, { status: 201 });
    }
  } catch (error) {
    captureServerException(error, { area: "assessment_write", action: parsed.data.action });
    return assessmentError(error);
  }
}
