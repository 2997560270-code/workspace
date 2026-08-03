import { apiError, requireApiUser } from "@/lib/api/server";
import type { ChallengeDecisionTimeline } from "@/lib/challenge-history";
import { PREMATURE_SOLUTION_COMMITMENT_CLAIM } from "@/lib/behavior-claims";
import { captureServerException } from "@/lib/monitoring/server";
import { getChallengeDecisionContext } from "@/lib/repositories/challenge-repository";
import { getDemoWorld } from "@/lib/world-seeds";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireApiUser();
  if (!user) return apiError("请先登录。", 401);
  const { id } = await params;

  try {
    const context = await getChallengeDecisionContext(user.id, id);
    if (!context) return apiError("决策事件不存在。", 404);
    const { run, decision, events, interventions } = context;
    const timeline: ChallengeDecisionTimeline = {
      run_id: run.id,
      decision_event_id: decision.id,
      world_id: run.world_id,
      world_version: run.world_version,
      world_title: getDemoWorld(run.world_id)?.title ?? run.world_id,
      status: run.status,
      started_at: run.started_at,
      completed_at: run.completed_at,
      chosen_action: decision.chosen_action,
      confidence: decision.confidence,
      consequences_revealed: decision.consequences_revealed,
      model_version: run.model_version,
      rubric_version: PREMATURE_SOLUTION_COMMITMENT_CLAIM.version,
      judgment: decision.judgment,
      expected_outcome: decision.expected_outcome,
      rejected_alternatives: decision.rejected_alternatives,
      evidence_basis: decision.evidence_basis,
      decision_created_at: decision.created_at,
      events,
      interventions,
    };
    return Response.json({ timeline });
  } catch (error) {
    captureServerException(error, { area: "decision_timeline", decisionEventId: id });
    return apiError("无法获取决策时间线，请稍后重试。", 503);
  }
}
