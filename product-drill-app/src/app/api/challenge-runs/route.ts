import { apiError, parseJsonBody, requireApiUser } from "@/lib/api/server";
import { CreateChallengeRunBodySchema } from "@/lib/api/challenge-schemas";
import { insertChallengeRun } from "@/lib/repositories/challenge-repository";
import { captureServerException } from "@/lib/monitoring/server";
import { isOpenAIConfigured, runtimeEnv } from "@/lib/env";
import { consumeModelRateLimit } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  const user = await requireApiUser();
  if (!user) return apiError("请先登录。", 401);

  const parsed = CreateChallengeRunBodySchema.safeParse(await parseJsonBody(request));
  if (!parsed.success) return apiError("参数无效。", 422, parsed.error.flatten());

  // BYOK / OpenAI 限流检查（demo 模式直接放行）
  if (user.source === "supabase") {
    const rateLimit = await consumeModelRateLimit(user, "roleplay");
    if (!rateLimit.allowed) {
      return apiError("请求过于频繁，请稍后再试。", 429, {
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      });
    }
  }

  const modelVersion = isOpenAIConfigured() ? runtimeEnv.modelVersion : "deterministic-v1";
  const unofficial = !isOpenAIConfigured(); // 确定性演示模式 = 非正式结果

  try {
    const run = await insertChallengeRun(
      user.id,
      parsed.data.world_id,
      parsed.data.world_version,
      modelVersion
    );
    return Response.json(
      {
        id: run.id,
        world_id: run.world_id,
        world_version: run.world_version,
        model_version: run.model_version,
        status: run.status,
        started_at: run.started_at,
        unofficial,
      },
      { status: 201 }
    );
  } catch (error) {
    captureServerException(error, { area: "create_challenge_run" });
    return apiError("无法创建训练运行，请稍后重试。", 503);
  }
}
