import { z } from "zod";
import { runtimeEnv } from "../env";
import { getOpenAIClient } from "./client";
import { requestStructuredResponse, StructuredResponseError } from "./structured-response";
import { aggregateCommunityReviews, type RawCommunityReview, type ReviewAggregate } from "../community-review";

const ReviewAggregateOutputSchema = z.object({
  summary: z.string().trim().min(1).max(2000),
  limitations: z.array(z.string().trim().min(1).max(400)).max(20),
});

function failureReason(error: unknown): ReviewAggregate["fallbackReason"] {
  if (error instanceof StructuredResponseError) {
    return error.reason === "schema_validation_failed" ? "schema_validation_failed" : error.reason === "response_parse_failed" ? "response_parse_failed" : "request_failed";
  }
  return "request_failed";
}

export async function aggregateCommunityReviewsWithAi(reviews: RawCommunityReview[]): Promise<ReviewAggregate> {
  const baseline = aggregateCommunityReviews(reviews);
  const client = getOpenAIClient();
  if (!client) return { ...baseline, fallbackReason: "model_not_configured" };
  try {
    const parsed = await requestStructuredResponse({
      client,
      model: runtimeEnv.evaluationModel,
      input: [
        "你是社区盲评的汇总助手。只能总结评审者已经提交的 Rubric、证据 ID、理由和置信度。",
        "不得替原始评审补造证据，不得抹平分歧，不得输出个人身份信息。",
        JSON.stringify(reviews.map(({ rubric, evidenceIds, reason, confidence }) => ({ rubric, evidenceIds, reason, confidence }))),
      ].join("\n\n"),
      schema: ReviewAggregateOutputSchema,
      schemaName: "community_review_aggregate",
    });
    return {
      ...baseline,
      engine: "ai",
      modelVersion: `${runtimeEnv.evaluationModel}:${runtimeEnv.modelVersion}`,
      summary: parsed.summary,
      limitations: parsed.limitations,
      fallbackReason: null,
    };
  } catch (error) {
    return { ...baseline, fallbackReason: failureReason(error) };
  }
}
