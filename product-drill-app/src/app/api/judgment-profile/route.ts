import { apiError, requireApiUser } from "@/lib/api/server";
import {
  getJudgmentProfile,
  getHypothesisEvidenceForProfile,
} from "@/lib/repositories/challenge-repository";
import { buildJudgmentProfile } from "@/lib/judgment-profile-builder";
import { captureServerException } from "@/lib/monitoring/server";

export async function GET() {
  const user = await requireApiUser();
  if (!user) return apiError("请先登录。", 401);

  try {
    const hypotheses = await getJudgmentProfile(user.id);
    const hypothesisIds = hypotheses.map((h) => h.id);
    const evidence = await getHypothesisEvidenceForProfile(hypothesisIds);

    const profile = buildJudgmentProfile({ hypotheses, evidence });
    return Response.json(profile);
  } catch (error) {
    captureServerException(error, { area: "judgment_profile" });
    return apiError("无法获取判断画像，请稍后重试。", 503);
  }
}
