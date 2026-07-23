import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { trackServerEvent } from "@/lib/analytics/server";
import { apiError, parseJsonBody, requireApiUser } from "@/lib/api/server";
import { CreateSessionBodySchema } from "@/lib/api/schemas";
import { runtimeEnv } from "@/lib/env";
import { captureServerException } from "@/lib/monitoring/server";
import { saveSessionSnapshot } from "@/lib/repositories/training-repository";
import { TRAINING_SCENARIOS } from "@/lib/training-config";
import { createTrainingSession } from "@/lib/training-session";

export async function POST(request: Request) {
  const user = await requireApiUser();
  if (!user) return apiError("请先登录。", 401);

  const parsed = CreateSessionBodySchema.safeParse(await parseJsonBody(request));
  if (!parsed.success) return apiError("训练参数无效。", 422, parsed.error.flatten());
  if (!TRAINING_SCENARIOS.some((scenario) => scenario.id === parsed.data.scenarioId)) {
    return apiError("训练场景不存在。", 404);
  }

  const session = createTrainingSession({
    scenarioId: parsed.data.scenarioId,
    mode: parsed.data.mode,
    rubricVersion: runtimeEnv.rubricVersion
  });

  try {
    const persisted = await saveSessionSnapshot(user.id, session);
    if (user.source === "supabase" && !persisted) return apiError("服务端持久化尚未配置。", 503);
    await trackServerEvent(user.id, ANALYTICS_EVENTS.trainingStarted, {
      scenarioId: session.scenarioId,
      scenarioVersion: session.scenarioVersion,
      rubricVersion: session.rubricVersion,
      modelVersion: session.modelVersion,
      engine: session.engine,
      mode: session.mode,
      source: user.source
    });
  } catch (error) {
    captureServerException(error, { area: "create_session", sessionId: session.id });
    return apiError("训练会话暂时无法保存，请稍后重试。", 503);
  }

  return Response.json({ session }, { status: 201 });
}
