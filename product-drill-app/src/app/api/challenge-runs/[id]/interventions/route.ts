import { apiError, parseJsonBody, requireApiUser } from "@/lib/api/server";
import { CreateInterventionBodySchema } from "@/lib/api/challenge-schemas";
import {
  insertIntervention,
  RunNotFoundError,
} from "@/lib/repositories/challenge-repository";
import { captureServerException } from "@/lib/monitoring/server";
import { isOpenAIConfigured, runtimeEnv } from "@/lib/env";
import { evaluateChallengeDecision } from "@/lib/challenge-evaluation";
import { selectNextChallengeForUser } from "@/lib/challenge-selection";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireApiUser();
  if (!user) return apiError("请先登录。", 401);

  const { id: runId } = await params;
  const parsed = CreateInterventionBodySchema.safeParse(await parseJsonBody(request));
  if (!parsed.success) return apiError("参数无效。", 422, parsed.error.flatten());

  const modelVersion = isOpenAIConfigured() ? runtimeEnv.modelVersion : "deterministic-v1";

  try {
    const evaluation =
      parsed.data.intervention_type === "feedback" && parsed.data.decision_event_id
        ? await evaluateChallengeDecision({
            userId: user.id,
            runId,
            decisionEventId: parsed.data.decision_event_id,
          })
        : null;
    const intervention = await insertIntervention({
      userId: user.id,
      runId,
      decisionEventId: parsed.data.decision_event_id,
      interventionType: parsed.data.intervention_type,
      content: evaluation?.feedback_content ?? parsed.data.content,
      modelVersion: evaluation?.degraded ? "deterministic-v1" : modelVersion,
    });
    const nextChallenge = evaluation
      ? await selectNextChallengeForUser(user.id, evaluation.progression_confidence)
      : null;
    return Response.json({
      intervention,
      evaluation: evaluation
        ? {
            confidence: evaluation.observation.confidence,
            update_direction: evaluation.update.update_direction,
            evidence_type: evaluation.evidence?.evidence_type ?? null,
            covered_dimensions: evaluation.covered_dimensions,
            missing_dimensions: evaluation.missing_dimensions,
            feedback_content: evaluation.feedback_content,
            formal: evaluation.formal,
            degraded: evaluation.degraded,
            duration_ms: evaluation.duration_ms,
          }
        : null,
      next_challenge: nextChallenge,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof RunNotFoundError) return apiError("训练运行不存在。", 404);
    captureServerException(error, { area: "create_intervention", runId });
    return apiError("无法记录干预，请稍后重试。", 503);
  }
}
