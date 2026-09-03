import { apiError, parseJsonBody, requireApiUser } from "@/lib/api/server";
import { CreateDecisionBodySchema } from "@/lib/api/challenge-schemas";
import { getDecisionFieldIssue } from "@/lib/workbench-state";
import {
  insertDecisionEvent,
  RunNotFoundError,
  InvalidRunStateError,
  DuplicateDecisionError,
} from "@/lib/repositories/challenge-repository";
import { captureServerException } from "@/lib/monitoring/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireApiUser();
  if (!user) return apiError("请先登录。", 401);

  const { id: runId } = await params;
  const parsed = CreateDecisionBodySchema.safeParse(await parseJsonBody(request));
  if (!parsed.success) return apiError("参数无效。", 422, parsed.error.flatten());

  // FB-013：服务端同样拦截乱码/过短的无效决策，防止绕过前端走完流程。
  const fieldIssues = {
    judgment: getDecisionFieldIssue(parsed.data.judgment),
    chosen_action: getDecisionFieldIssue(parsed.data.chosen_action),
    expected_outcome: getDecisionFieldIssue(parsed.data.expected_outcome),
  };
  if (Object.values(fieldIssues).some(Boolean)) {
    return apiError("决策内容无效：请写出具体的判断、行动和预期结果。", 422, { fieldErrors: fieldIssues });
  }

  try {
    const dec = await insertDecisionEvent({
      userId: user.id,
      runId,
      worldEventId: parsed.data.world_event_id,
      judgment: parsed.data.judgment,
      chosenAction: parsed.data.chosen_action,
      expectedOutcome: parsed.data.expected_outcome,
      confidence: parsed.data.confidence,
      rejectedAlternatives: parsed.data.rejected_alternatives,
      evidenceBasis: parsed.data.evidence_basis,
    });
    return Response.json(
      {
        id: dec.id,
        run_id: dec.run_id,
        consequences_revealed: dec.consequences_revealed,
        created_at: dec.created_at,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof RunNotFoundError) return apiError("训练运行不存在。", 404);
    if (error instanceof InvalidRunStateError) return apiError("训练运行已结束，无法提交决策。", 409);
    if (error instanceof DuplicateDecisionError) return apiError("该事件已存在决策记录，不能重复提交。", 409);
    captureServerException(error, { area: "create_decision_event", runId });
    return apiError("无法保存决策，请稍后重试。", 503);
  }
}
