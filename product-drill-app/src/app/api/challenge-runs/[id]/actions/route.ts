import { apiError, parseJsonBody, requireApiUser } from "@/lib/api/server";
import { AppendActionBodySchema } from "@/lib/api/challenge-schemas";
import { narrateWorldResponse } from "@/lib/ai/causal-pipeline";
import { isOpenAIConfigured } from "@/lib/env";
import {
  appendWorldEvent,
  getChallengeRun,
  getWorldEventsForRun,
  RunNotFoundError,
  InvalidRunStateError,
} from "@/lib/repositories/challenge-repository";
import { captureServerException } from "@/lib/monitoring/server";
import { getDemoWorld } from "@/lib/world-seeds";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireApiUser();
  if (!user) return apiError("请先登录。", 401);

  const { id: runId } = await params;
  const parsed = AppendActionBodySchema.safeParse(await parseJsonBody(request));
  if (!parsed.success) return apiError("参数无效。", 422, parsed.error.flatten());

  try {
    const evt = await appendWorldEvent({
      runId,
      userId: user.id,
      eventType: parsed.data.event_type,
      sequenceIndex: parsed.data.sequence_index,
      actor: parsed.data.actor,
      payload: parsed.data.payload,
    });
    const run = await getChallengeRun(user.id, runId);
    const world = run ? getDemoWorld(run.world_id) : undefined;
    const userAction = parsed.data.payload.text ?? "";
    const eventHistory = await getWorldEventsForRun(user.id, runId);
    const narration = world && parsed.data.actor === "user"
      ? await narrateWorldResponse({
          worldVersion: world.version,
          userAction,
          eventHistory,
          revealedFactIds: [],
        })
      : null;

    return Response.json(
      {
        event_id: evt.id,
        narration: narration?.narration,
        unofficial: narration?.unofficial ?? !isOpenAIConfigured(),
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof RunNotFoundError) return apiError("训练运行不存在。", 404);
    if (error instanceof InvalidRunStateError) return apiError("训练运行已结束，无法追加事件。", 409);
    captureServerException(error, { area: "append_world_event", runId });
    return apiError("无法追加事件，请稍后重试。", 503);
  }
}
