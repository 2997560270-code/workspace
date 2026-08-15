import { z } from "zod";
import { apiError, parseJsonBody, requireApiUser } from "@/lib/api/server";
import { captureServerException } from "@/lib/monitoring/server";
import { listSeasonalChallengesRecord, listSeasonalChallengeLeaderboardRecord, createSeasonalChallengeRecord, publishSeasonalChallengeRecord, enterSeasonalChallengeRecord, submitSeasonalChallengeAttemptRecord, createReviewRerouteRecord, flagReviewAnomalyRecord, issueTrainingCreditRecord, recalculateReviewerReputationRecord, submitReviewQualityVoteRecord } from "@/lib/repositories/community-governance-repository";

const RequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("quality_vote"), reviewId: z.string().uuid(), vote: z.enum(["helpful", "unclear", "harmful"]), reason: z.string().trim().min(20).max(1000) }),
  z.object({ action: z.literal("recalculate_reputation"), cohortId: z.string().uuid() }),
  z.object({ action: z.literal("reroute"), poolEntryId: z.string().uuid(), aggregateId: z.string().uuid().optional(), reason: z.string().trim().min(10).max(1000) }),
  z.object({ action: z.literal("issue_credit"), recipientId: z.string().uuid(), sourceReviewId: z.string().uuid(), amount: z.number().int().min(1).max(20), reason: z.string().trim().min(4).max(400), expiresAt: z.string().datetime() }),
  z.object({ action: z.literal("create_challenge"), slug: z.string().trim().regex(/^[a-z0-9-]{3,80}$/), title: z.string().trim().min(2).max(160), description: z.string().trim().min(10).max(4000), startsAt: z.string().datetime(), endsAt: z.string().datetime(), challengePool: z.array(z.unknown()).min(1).max(100) }),
  z.object({ action: z.literal("publish_challenge"), challengeId: z.string().uuid() }),
  z.object({ action: z.literal("enter_challenge"), challengeId: z.string().uuid() }),
  z.object({ action: z.literal("submit_challenge_attempt"), challengeId: z.string().uuid(), score: z.number().min(0).max(1) }),
  z.object({ action: z.literal("flag_anomaly"), cohortId: z.string().uuid().optional(), reviewerId: z.string().uuid().optional(), challengeId: z.string().uuid().optional(), signalType: z.enum(["rate_limit", "account_linkage", "copy_pattern", "conflict_bypass", "quality_outlier"]), severity: z.enum(["low", "medium", "high"]), evidence: z.record(z.string(), z.unknown()) }),
]);

function governanceError(error: unknown) {
  const message = error instanceof Error ? error.message : "Governance request failed";
  if (message === "Governance persistence is not configured") return apiError("社区治理服务尚未配置数据库。", 503);
  if (message === "Admin role required") return apiError("需要管理员权限。", 403);
  if (message === "Reviewers cannot vote on their own review") return apiError("不能评价自己的盲评。", 403);
  if (message === "Credit cap reached") return apiError("该用户的训练额度已达到上限。", 409);
  if (message === "Challenge is not available" || message === "Challenge is outside its active window") return apiError("赛季挑战当前不可参加。", 409);
  return apiError("社区治理操作失败。", 400);
}

export async function GET(request: Request) {
  const user = await requireApiUser();
  if (!user) return apiError("请先登录。", 401);
  try {
    const challengeId = new URL(request.url).searchParams.get("challengeId");
    return challengeId
      ? Response.json({ leaderboard: await listSeasonalChallengeLeaderboardRecord(challengeId) })
      : Response.json({ challenges: await listSeasonalChallengesRecord() });
  } catch (error) {
    captureServerException(error, { area: "governance_read" });
    return apiError("社区治理信息暂时无法读取。", 503);
  }
}

export async function POST(request: Request) {
  const user = await requireApiUser();
  if (!user) return apiError("请先登录。", 401);
  const parsed = RequestSchema.safeParse(await parseJsonBody(request));
  if (!parsed.success) return apiError("社区治理请求格式不正确。", 400, parsed.error.flatten());
  try {
    switch (parsed.data.action) {
      case "quality_vote": return Response.json({ vote: await submitReviewQualityVoteRecord(user.id, parsed.data) }, { status: 201 });
      case "recalculate_reputation": return Response.json({ reputation: await recalculateReviewerReputationRecord(user.id, parsed.data.cohortId) });
      case "reroute": return Response.json({ reroute: await createReviewRerouteRecord(user.id, parsed.data) }, { status: 201 });
      case "issue_credit": return Response.json({ credit: await issueTrainingCreditRecord(user.id, parsed.data) }, { status: 201 });
      case "create_challenge": return Response.json({ challenge: await createSeasonalChallengeRecord(user.id, parsed.data) }, { status: 201 });
      case "publish_challenge": return Response.json({ challenge: await publishSeasonalChallengeRecord(user.id, parsed.data.challengeId) });
      case "enter_challenge": return Response.json({ entry: await enterSeasonalChallengeRecord(user.id, parsed.data.challengeId) }, { status: 201 });
      case "submit_challenge_attempt": return Response.json({ entry: await submitSeasonalChallengeAttemptRecord(user.id, parsed.data.challengeId, parsed.data.score) }, { status: 201 });
      case "flag_anomaly": return Response.json({ flag: await flagReviewAnomalyRecord(user.id, parsed.data) }, { status: 201 });
    }
  } catch (error) {
    captureServerException(error, { area: "governance_write", action: parsed.data.action });
    return governanceError(error);
  }
}
