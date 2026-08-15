import { z } from "zod";
import { apiError, parseJsonBody, requireApiUser } from "@/lib/api/server";
import { captureServerException } from "@/lib/monitoring/server";
import { appendVerifiedEventRecord, approveVerifiedOrganizationRecord, createVerifiedOrganizationRecord, createVerifiedReportRecord, recordVerifiedEnvironmentRecord, recordVerifiedIdentityRecord, reviewVerifiedSessionRecord, startVerifiedSessionRecord, completeVerifiedSessionRecord } from "@/lib/repositories/verified-pilot-repository";

const EnvironmentSchema = z.object({ browser: z.string().trim().min(1).max(120), operatingSystem: z.string().trim().min(1).max(120), timezone: z.string().trim().min(1).max(120), policyVersion: z.string().trim().min(1).max(80) });
const RequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create_organization"), name: z.string().trim().min(2).max(200) }),
  z.object({ action: z.literal("approve_organization"), organizationId: z.string().uuid(), status: z.enum(["approved", "suspended", "closed"]) }),
  z.object({ action: z.literal("start"), organizationId: z.string().uuid(), assessmentRunId: z.string().uuid(), consentVersion: z.string().trim().min(1).max(80) }),
  z.object({ action: z.literal("identity"), sessionId: z.string().uuid(), status: z.enum(["verified", "failed", "waived"]) }),
  z.object({ action: z.literal("environment"), sessionId: z.string().uuid(), environment: EnvironmentSchema }),
  z.object({ action: z.literal("event"), sessionId: z.string().uuid(), event: z.object({ type: z.enum(["identity_check", "environment_recorded", "item_started", "item_submitted", "pause", "resume", "exception", "human_review"]), payload: z.record(z.string(), z.unknown()) }) }),
  z.object({ action: z.literal("complete"), sessionId: z.string().uuid() }),
  z.object({ action: z.literal("human_review"), sessionId: z.string().uuid(), decision: z.enum(["cleared", "flagged"]), notes: z.string().trim().max(2000).optional() }),
  z.object({ action: z.literal("report"), sessionId: z.string().uuid(), score: z.number().min(0).max(1) }),
]);

function verifiedError(error: unknown) {
  const message = error instanceof Error ? error.message : "Verified assessment request failed";
  if (message === "Verified pilot persistence is not configured") return apiError("受验证试点服务尚未配置数据库。", 503);
  if (message === "Admin role required") return apiError("需要管理员权限。", 403);
  if (message === "Verified session belongs to another user") return apiError("无权操作该受验证场次。", 403);
  if (/approved organization|submitted before|Manual identity|Environment record|Human review/.test(message)) return apiError(message, 409);
  return apiError("受验证考核操作失败。", 400);
}

export async function POST(request: Request) {
  const user = await requireApiUser();
  if (!user) return apiError("请先登录。", 401);
  const parsed = RequestSchema.safeParse(await parseJsonBody(request));
  if (!parsed.success) return apiError("受验证考核请求格式不正确。", 400, parsed.error.flatten());
  try {
    switch (parsed.data.action) {
      case "create_organization": return Response.json({ organization: await createVerifiedOrganizationRecord(user.id, parsed.data.name) }, { status: 201 });
      case "approve_organization": return Response.json({ organization: await approveVerifiedOrganizationRecord(user.id, parsed.data.organizationId, parsed.data.status) });
      case "start": return Response.json({ session: await startVerifiedSessionRecord(user.id, parsed.data) }, { status: 201 });
      case "identity": return Response.json({ session: await recordVerifiedIdentityRecord(user.id, parsed.data.sessionId, parsed.data.status) });
      case "environment": return Response.json({ session: await recordVerifiedEnvironmentRecord(user.id, parsed.data.sessionId, parsed.data.environment) });
      case "event": return Response.json({ session: await appendVerifiedEventRecord(user.id, parsed.data.sessionId, parsed.data.event) });
      case "complete": return Response.json({ session: await completeVerifiedSessionRecord(user.id, parsed.data.sessionId) });
      case "human_review": return Response.json({ session: await reviewVerifiedSessionRecord(user.id, parsed.data.sessionId, parsed.data.decision, parsed.data.notes) });
      case "report": return Response.json({ report: await createVerifiedReportRecord(user.id, parsed.data.sessionId, parsed.data.score) }, { status: 201 });
    }
  } catch (error) {
    captureServerException(error, { area: "verified_assessment_write", action: parsed.data.action });
    return verifiedError(error);
  }
}
