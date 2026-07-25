import { apiError, parseJsonBody, requireApiUser } from "@/lib/api/server";
import { RevealConsequencesBodySchema } from "@/lib/api/challenge-schemas";
import {
  revealDecisionConsequences,
  RunNotFoundError,
  AlreadyRevealedError,
} from "@/lib/repositories/challenge-repository";
import { captureServerException } from "@/lib/monitoring/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireApiUser();
  if (!user) return apiError("请先登录。", 401);

  const { id: runId } = await params;
  const parsed = RevealConsequencesBodySchema.safeParse(await parseJsonBody(request));
  if (!parsed.success) return apiError("参数无效。", 422, parsed.error.flatten());

  try {
    const dec = await revealDecisionConsequences(
      user.id,
      runId,
      parsed.data.decision_event_id
    );
    return Response.json({
      id: dec.id,
      run_id: dec.run_id,
      consequences_revealed: dec.consequences_revealed,
    });
  } catch (error) {
    if (error instanceof RunNotFoundError) return apiError("训练运行或决策事件不存在。", 404);
    if (error instanceof AlreadyRevealedError) return apiError("该决策的后果已经揭示，不能重复操作。", 409);
    captureServerException(error, { area: "reveal_consequences", runId });
    return apiError("无法揭示后果，请稍后重试。", 503);
  }
}
