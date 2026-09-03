import { apiError, parseJsonBody, requireApiUser } from "@/lib/api/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  FeedbackListQuerySchema,
  FeedbackSubmissionSchema
} from "@/lib/api/feedback-schemas";
import { createFeedbackRecord, listFeedbackRecords } from "@/lib/repositories/feedback-repository";
import { captureServerException } from "@/lib/monitoring/server";
import type { ProductDrillUser } from "@/lib/auth";

function feedbackError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "Feedback persistence is not configured") return apiError("反馈服务尚未配置数据库。", 503);
  return apiError("反馈操作失败。", 400);
}

async function isAdminUser(user: ProductDrillUser): Promise<boolean> {
  // demo / 本地账号在开发环境直接视为管理员；正式 Supabase 账号按 profiles.account_role 判定。
  if (user.source !== "supabase") return true;
  const admin = createSupabaseAdminClient();
  if (!admin) return false;
  const { data, error } = await admin.from("profiles").select("account_role").eq("id", user.id).maybeSingle();
  if (error) throw error;
  return data?.account_role === "admin";
}

export async function POST(request: Request) {
  const user = await requireApiUser();
  const parsed = FeedbackSubmissionSchema.safeParse(await parseJsonBody(request));
  if (!parsed.success) return apiError("反馈内容格式无效。", 422, parsed.error.flatten());

  try {
    const record = await createFeedbackRecord(parsed.data, user?.id ?? null, request.headers.get("user-agent"));
    return Response.json({ record }, { status: 201 });
  } catch (error) {
    captureServerException(error, { area: "feedback_submit", category: parsed.data.category });
    return feedbackError(error);
  }
}

export async function GET(request: Request) {
  const user = await requireApiUser();
  if (!user) return apiError("请先登录。", 401);

  const url = new URL(request.url);
  const parsed = FeedbackListQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return apiError("查询参数无效。", 400, parsed.error.flatten());

  try {
    if (!(await isAdminUser(user))) return apiError("需要管理员权限。", 403);
    return Response.json({ records: await listFeedbackRecords(parsed.data) });
  } catch (error) {
    captureServerException(error, { area: "feedback_list" });
    return feedbackError(error);
  }
}
