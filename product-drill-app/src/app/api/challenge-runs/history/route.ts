import { apiError, requireApiUser } from "@/lib/api/server";
import type { ChallengeDecisionSummary } from "@/lib/challenge-history";
import { captureServerException } from "@/lib/monitoring/server";
import { getChallengeDecisionRecords } from "@/lib/repositories/challenge-repository";
import { getDemoWorld } from "@/lib/world-seeds";

export async function GET() {
  const user = await requireApiUser();
  if (!user) return apiError("请先登录。", 401);

  try {
    const records = await getChallengeDecisionRecords(user.id);
    const summaries: ChallengeDecisionSummary[] = records.map(({ run, decision }) => ({
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
    }));
    return Response.json({ records: summaries });
  } catch (error) {
    captureServerException(error, { area: "challenge_history" });
    return apiError("无法获取世界训练记录，请稍后重试。", 503);
  }
}
