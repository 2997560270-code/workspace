import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: { id: "user-1", email: "user@example.com", name: "User", source: "supabase" as const } as { id: string; email: string; name: string; source: "supabase" } | null,
  createCohort: vi.fn(),
  joinCohort: vi.fn(),
  listCohorts: vi.fn(),
  listAssignments: vi.fn(),
  openAssignment: vi.fn(),
  declareConflict: vi.fn(),
  submitReview: vi.fn(),
  recordMeasurement: vi.fn(),
}));

vi.mock("../src/lib/api/server", () => ({
  apiError: (message: string, status = 400, details?: unknown) => Response.json({ error: message, details }, { status }),
  parseJsonBody: async (request: Request) => request.json().catch(() => null),
  requireApiUser: async () => mocks.user,
}));
vi.mock("../src/lib/monitoring/server", () => ({ captureServerException: vi.fn() }));
vi.mock("../src/lib/repositories/validation-repository", () => ({
  createValidationCohortRecord: mocks.createCohort,
  joinValidationCohortRecord: mocks.joinCohort,
  getValidationCohortsForUser: mocks.listCohorts,
  getBlindReviewAssignments: mocks.listAssignments,
  openBlindReviewAssignment: mocks.openAssignment,
  declareBlindReviewConflict: mocks.declareConflict,
  submitBlindReviewRecord: mocks.submitReview,
  recordValidationMeasurement: mocks.recordMeasurement,
}));

import { GET as getCohorts, POST as postCohorts } from "../src/app/api/validation/cohorts/route";
import { GET as getReviews, PATCH as openReview, POST as postReviews } from "../src/app/api/validation/reviews/route";
import { POST as postMeasurement } from "../src/app/api/validation/measurements/route";

function jsonRequest(body: unknown, method = "POST") {
  return new Request("http://localhost/api/validation", { method, body: JSON.stringify(body), headers: { "content-type": "application/json" } });
}

describe("validation APIs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = { id: "user-1", email: "user@example.com", name: "User", source: "supabase" };
    mocks.createCohort.mockResolvedValue({ id: "cohort-1", name: "Pilot", invite_code: "ABCDEFGHIJ" });
    mocks.joinCohort.mockResolvedValue({ cohort_id: "cohort-1", user_id: "user-1" });
    mocks.listCohorts.mockResolvedValue([]);
    mocks.listAssignments.mockResolvedValue([]);
    mocks.openAssignment.mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111", status: "opened" });
    mocks.declareConflict.mockResolvedValue({ status: "expired", conflict_declared: true });
    mocks.submitReview.mockResolvedValue({ id: "review-1" });
    mocks.recordMeasurement.mockResolvedValue({ id: "measurement-1" });
  });

  it("requires authentication for cohort reads", async () => {
    mocks.user = null;
    const response = await getCohorts();
    expect(response.status).toBe(401);
  });

  it("validates cohort creation and forwards only valid data", async () => {
    const invalid = await postCohorts(jsonRequest({ action: "create", name: "x" }));
    expect(invalid.status).toBe(400);
    expect(mocks.createCohort).not.toHaveBeenCalled();

    const valid = await postCohorts(jsonRequest({ action: "create", name: "封闭试验 01" }));
    expect(valid.status).toBe(201);
    expect(mocks.createCohort).toHaveBeenCalledWith("user-1", "封闭试验 01");
  });

  it("accepts an invite only with role and consent version", async () => {
    const response = await postCohorts(jsonRequest({ action: "join", code: "abcdefghij", role: "target_user", consentVersion: "2026-08-15" }));
    expect(response.status).toBe(201);
    expect(mocks.joinCohort).toHaveBeenCalledWith("user-1", "abcdefghij", "target_user", "2026-08-15");
  });

  it("lists assignments and opens only a valid assignment id", async () => {
    expect((await getReviews()).status).toBe(200);
    const response = await openReview(jsonRequest({ assignmentId: "not-a-uuid" }, "PATCH"));
    expect(response.status).toBe(400);
    expect(mocks.openAssignment).not.toHaveBeenCalled();
  });

  it("requires evidence-based reason for a blind review", async () => {
    const response = await postReviews(jsonRequest({ assignmentId: "11111111-1111-4111-8111-111111111111", rubric: { evidence: "meets" }, evidenceIds: [], reason: "太短", confidence: "low" }));
    expect(response.status).toBe(400);
    expect(mocks.submitReview).not.toHaveBeenCalled();
  });

  it("preserves conflict declarations separately from submitted reviews", async () => {
    const conflict = await postReviews(jsonRequest({ assignmentId: "11111111-1111-4111-8111-111111111111", conflictDeclared: true }));
    expect(conflict.status).toBe(200);
    expect(mocks.declareConflict).toHaveBeenCalledWith("user-1", "11111111-1111-4111-8111-111111111111");

    const review = await postReviews(jsonRequest({ assignmentId: "11111111-1111-4111-8111-111111111111", rubric: { evidence: "meets" }, evidenceIds: ["event-1"], reason: "引用了决策事件，并明确说明了仍然存在的不确定性。", confidence: "medium" }));
    expect(review.status).toBe(201);
    expect(mocks.submitReview).toHaveBeenCalledWith("user-1", expect.objectContaining({ conflictDeclared: false, evidenceIds: ["event-1"] }));
  });

  it("keeps baseline measurements admin-only through the repository boundary", async () => {
    const response = await postMeasurement(jsonRequest({ cohortId: "11111111-1111-4111-8111-111111111111", participantId: "22222222-2222-4222-8222-222222222222", metricType: "repeatability", value: 0.75 }));
    expect(response.status).toBe(201);
    expect(mocks.recordMeasurement).toHaveBeenCalledWith("user-1", expect.objectContaining({ metricType: "repeatability", value: 0.75 }));
  });
});
