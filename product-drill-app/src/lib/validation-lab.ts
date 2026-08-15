export type ValidationParticipantRole = "target_user" | "pm_reviewer" | "hiring_reviewer" | "researcher";
export type ValidationCohortStatus = "draft" | "recruiting" | "active" | "closed";

export type ValidationParticipant = { userId: string; name: string; role: ValidationParticipantRole; status: "invited" | "active" | "completed" | "withdrawn" };
export type ValidationCohort = { id: string; name: string; inviteCode: string; status: ValidationCohortStatus; createdAt: string; participants: ValidationParticipant[] };
export type BlindReview = { id: string; cohortId: string; reviewerId: string; subject: string; rubric: Record<string, string>; reason: string; confidence: "high" | "medium" | "low"; submittedAt: string };
export type ValidationMetric = { type: "repeatability" | "user_understanding" | "provisional_transfer" | "reviewer_agreement"; value: number; note: string };
export type ValidationState = { cohorts: ValidationCohort[]; reviews: BlindReview[]; metrics: ValidationMetric[] };

export const VALIDATION_STORAGE_KEY = "product-drill-validation-lab-v1";

function id(prefix: string) { return `${prefix}-${crypto.randomUUID()}`; }
function code() { return crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase(); }

export function createValidationCohort(name: string): ValidationCohort {
  return { id: id("cohort"), name: name.trim(), inviteCode: code(), status: "recruiting", createdAt: new Date().toISOString(), participants: [] };
}

export function joinValidationCohort(cohort: ValidationCohort, participant: ValidationParticipant): ValidationCohort {
  if (cohort.participants.some((item) => item.userId === participant.userId)) return cohort;
  return { ...cohort, participants: [...cohort.participants, participant] };
}

export function saveValidationState(state: ValidationState): void {
  if (typeof window !== "undefined") window.localStorage.setItem(VALIDATION_STORAGE_KEY, JSON.stringify(state));
}

export function loadValidationState(): ValidationState {
  if (typeof window === "undefined") return { cohorts: [], reviews: [], metrics: [] };
  try {
    const raw = window.localStorage.getItem(VALIDATION_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object") return { cohorts: [], reviews: [], metrics: [] };
    const value = parsed as Partial<ValidationState>;
    return { cohorts: Array.isArray(value.cohorts) ? value.cohorts : [], reviews: Array.isArray(value.reviews) ? value.reviews : [], metrics: Array.isArray(value.metrics) ? value.metrics : [] };
  } catch { return { cohorts: [], reviews: [], metrics: [] }; }
}

export function createReview(input: Omit<BlindReview, "id" | "submittedAt">): BlindReview {
  return { ...input, id: id("review"), submittedAt: new Date().toISOString() };
}
