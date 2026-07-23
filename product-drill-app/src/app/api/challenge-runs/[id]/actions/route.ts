import { apiError, parseJsonBody, requireApiUser } from "@/lib/api/server";
import { AppendActionBodySchema } from "@/lib/api/challenge-schemas";
import { appendWorldEvent, RunNotFoundError, InvalidRunStateError } from "@/lib/repositories/challenge-repository";
import { captureServerException } from "@/lib/monitoring/server";

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
    return Response.json({ event: evt }, { status: 201 });
  } catch (error) {
    if (error instanceof RunNotFoundError) return apiError("训练运行不存在。", 404);
    if (error instanceof InvalidRunStateError) return apiError("训练运行已结束，无法追加事件。", 409);
    captureServerException(error, { area: "append_world_event", runId });
    return apiError("无法追加事件，请稍后重试。", 503);
  }
}
