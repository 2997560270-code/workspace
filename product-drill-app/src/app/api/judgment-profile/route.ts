import { apiError, requireApiUser } from "@/lib/api/server";
import { getJudgmentProfile } from "@/lib/repositories/challenge-repository";
import { captureServerException } from "@/lib/monitoring/server";
import type { JudgmentProfileResponse } from "@/lib/api/challenge-schemas";

export async function GET() {
  const user = await requireApiUser();
  if (!user) return apiError("请先登录。", 401);

  try {
    const hypotheses = await getJudgmentProfile(user.id);
    const response: JudgmentProfileResponse = {
      hypotheses: hypotheses.map((h) => ({
        id: h.id,
        habit_name: h.habit_name,
        confidence: h.confidence,
        trigger_conditions: h.trigger_conditions,
        supporting_evidence_count: h.supporting_evidence_ids.length,
        counter_evidence_count: h.counter_evidence_ids.length,
        last_updated_at: h.last_updated_at,
      })),
    };
    return Response.json(response);
  } catch (error) {
    captureServerException(error, { area: "judgment_profile" });
    return apiError("无法获取判断画像，请稍后重试。", 503);
  }
}
