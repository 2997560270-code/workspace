import { apiError, parseJsonBody, requireApiUser } from "@/lib/api/server";
import { CreateInterventionBodySchema } from "@/lib/api/challenge-schemas";
import {
  insertIntervention,
  RunNotFoundError,
} from "@/lib/repositories/challenge-repository";
import { captureServerException } from "@/lib/monitoring/server";
import { isOpenAIConfigured, runtimeEnv } from "@/lib/env";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireApiUser();
  if (!user) return apiError("请先登录。", 401);

  const { id: runId } = await params;
  const parsed = CreateInterventionBodySchema.safeParse(await parseJsonBody(request));
  if (!parsed.success) return apiError("参数无效。", 422, parsed.error.flatten());

  const modelVersion = isOpenAIConfigured() ? runtimeEnv.modelVersion : "deterministic-v1";

  try {
    const intervention = await insertIntervention({
      userId: user.id,
      runId,
      decisionEventId: parsed.data.decision_event_id,
      interventionType: parsed.data.intervention_type,
      content: parsed.data.content,
      modelVersion,
      worldVersion: "unknown", // worldVersion resolved from run in production
    });
    return Response.json({ intervention }, { status: 201 });
  } catch (error) {
    if (error instanceof RunNotFoundError) return apiError("训练运行不存在。", 404);
    captureServerException(error, { area: "create_intervention", runId });
    return apiError("无法记录干预，请稍后重试。", 503);
  }
}
