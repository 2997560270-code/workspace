import { z } from "zod";

export const ReviewConfidenceSchema = z.enum(["high", "medium", "low"]);
export type ReviewConfidence = z.infer<typeof ReviewConfidenceSchema>;

export type ReviewPoolEntry = {
  id: string;
  cohortId: string;
  subjectUserId?: string;
  decisionEventId?: string;
  anchorCaseId?: string;
  anonymizedSubjectId: string;
  conflictGroup?: string;
  status: "ready" | "exhausted" | "paused" | "retired";
};

export type ReviewAssignment = {
  id: string;
  cohortId: string;
  reviewerId: string;
  poolEntryId: string;
  anonymizedSubjectId: string;
  status: "assigned" | "opened" | "submitted" | "expired";
  conflictDeclared: boolean;
};

export type RawCommunityReview = {
  id: string;
  assignmentId: string;
  rubric: Record<string, unknown>;
  evidenceIds: string[];
  reason: string;
  confidence: ReviewConfidence;
};

export type ReviewAggregate = {
  engine: "ai" | "deterministic";
  modelVersion: string;
  rubricSummary: Record<string, Record<string, number>>;
  disagreement: {
    score: number;
    fields: string[];
    needsReReview: boolean;
  };
  summary: string;
  limitations: string[];
  fallbackReason: "model_not_configured" | "request_failed" | "response_parse_failed" | "schema_validation_failed" | null;
  rawReviewIds: string[];
  status: "provisional" | "needs_re_review";
};

function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function createAnonymizedSubjectId(randomUuid = crypto.randomUUID()) {
  return `subject-${randomUuid.replace(/-/g, "").slice(0, 10).toUpperCase()}`;
}

export function createReviewPoolEntry(input: Omit<ReviewPoolEntry, "anonymizedSubjectId" | "status">): ReviewPoolEntry {
  if (Boolean(input.decisionEventId) === Boolean(input.anchorCaseId)) {
    throw new Error("A review pool entry must reference exactly one subject");
  }
  return { ...input, anonymizedSubjectId: createAnonymizedSubjectId(), status: "ready" };
}

export function assignRandomReview(input: {
  reviewerId: string;
  pool: ReviewPoolEntry[];
  existingAssignments?: ReviewAssignment[];
  conflictGroups?: string[];
  random?: () => number;
}): ReviewAssignment | null {
  const assignedPoolIds = new Set((input.existingAssignments ?? [])
    .filter((assignment) => assignment.reviewerId === input.reviewerId)
    .map((assignment) => assignment.poolEntryId));
  const conflicts = new Set(input.conflictGroups ?? []);
  const eligible = input.pool.filter((entry) => entry.status === "ready"
    && !assignedPoolIds.has(entry.id)
    && !conflicts.has(entry.conflictGroup ?? "")
    && entry.subjectUserId !== input.reviewerId);
  if (!eligible.length) return null;
  const random = input.random ?? Math.random;
  const selected = eligible[Math.min(eligible.length - 1, Math.floor(Math.max(0, random()) * eligible.length))];
  return {
    id: makeId("assignment"),
    cohortId: selected.cohortId,
    reviewerId: input.reviewerId,
    poolEntryId: selected.id,
    anonymizedSubjectId: selected.anonymizedSubjectId,
    status: "assigned",
    conflictDeclared: false,
  };
}

export function aggregateCommunityReviews(reviews: RawCommunityReview[], engine: "ai" | "deterministic" = "deterministic", modelVersion = "deterministic-review-v1"): ReviewAggregate {
  const rubricSummary: Record<string, Record<string, number>> = {};
  const fields = new Set<string>();
  for (const review of reviews) {
    for (const [field, value] of Object.entries(review.rubric)) {
      const normalized = typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : "[structured]";
      fields.add(field);
      rubricSummary[field] ??= {};
      rubricSummary[field][normalized] = (rubricSummary[field][normalized] ?? 0) + 1;
    }
  }
  const disagreeingFields = [...fields].filter((field) => Object.keys(rubricSummary[field]).length > 1);
  const score = fields.size ? disagreeingFields.length / fields.size : 1;
  return {
    engine,
    modelVersion,
    rubricSummary,
    disagreement: { score, fields: disagreeingFields, needsReReview: score > 0.4 || reviews.length < 2 },
    summary: reviews.length
      ? `已保留 ${reviews.length} 份原始评审；${disagreeingFields.length ? `有 ${disagreeingFields.length} 个 Rubric 维度存在分歧` : "当前 Rubric 维度未发现分歧"}。`
      : "暂无足够的原始评审，不能形成汇总。",
    limitations: reviews.length < 2 ? ["至少需要两份独立评审才能评估一致性。"] : [],
    fallbackReason: null,
    rawReviewIds: reviews.map((review) => review.id),
    status: score > 0.4 || reviews.length < 2 ? "needs_re_review" : "provisional",
  };
}

export function validateCommunityReview(input: RawCommunityReview): RawCommunityReview {
  if (!input.assignmentId || !input.id) throw new Error("Review identity is required");
  if (Object.keys(input.rubric).length === 0) throw new Error("Rubric is required");
  if (input.reason.trim().length < 20) throw new Error("Review reason must contain at least 20 characters");
  ReviewConfidenceSchema.parse(input.confidence);
  return { ...input, reason: input.reason.trim() };
}
