import { apiError, requireApiUser } from "@/lib/api/server";
import { selectNextChallengeForUser } from "@/lib/challenge-selection";
import { captureServerException } from "@/lib/monitoring/server";

export async function GET() {
  const user = await requireApiUser();
  if (!user) return apiError("请先登录。", 401);

  try {
    const selection = await selectNextChallengeForUser(user.id);
    return Response.json({ selection });
  } catch (error) {
    captureServerException(error, { area: "next_challenge_selection" });
    return apiError("暂时无法选择下一个情境，请稍后重试。", 503);
  }
}
