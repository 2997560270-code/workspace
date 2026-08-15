import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { rm } from "node:fs/promises";
import path from "node:path";

const auth = vi.hoisted(() => ({
  user: { id: "local-integration-user", email: "local@example.com", name: "Local Integration User", source: "demo" as const },
}));

vi.mock("../src/lib/api/server", () => ({
  apiError: (message: string, status = 400, details?: unknown) => Response.json({ error: message, details }, { status }),
  parseJsonBody: async (request: Request) => request.json().catch(() => null),
  requireApiUser: async () => auth.user,
}));
vi.mock("../src/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => null }));
vi.mock("../src/lib/monitoring/server", () => ({ captureServerException: vi.fn() }));

import { POST as postValidationCohort } from "../src/app/api/validation/cohorts/route";
import { POST as postAssessment } from "../src/app/api/assessments/route";
import { POST as postVerifiedAssessment } from "../src/app/api/verified-assessments/route";
import { GET as getTeam, POST as postTeam } from "../src/app/api/teams/route";
import { GET as getResources, POST as postResource } from "../src/app/api/resources/route";
import { PATCH as patchResource } from "../src/app/api/admin/resources/[id]/route";
import { GET as getBilling } from "../src/app/api/billing/route";
import { withLocalRuntimeState } from "../src/lib/local-runtime-store";

const statePath = path.join(process.cwd(), "data", "local-runtime-state.json");

function request(body: unknown) {
  return new Request("http://localhost/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function body(response: Response) {
  return response.json() as Promise<Record<string, any>>;
}

describe("local runtime API persistence", () => {
  beforeAll(async () => {
    process.env.ALLOW_DEMO_AUTH = "true";
    await rm(statePath, { force: true });
  });

  afterAll(async () => {
    await rm(statePath, { force: true });
  });

  it("persists validation cohorts and supports joining by invite code", async () => {
    const createdResponse = await postValidationCohort(request({ action: "create", name: "Local integration cohort" }));
    expect(createdResponse.status).toBe(201);
    const created = await body(createdResponse);
    expect(created.cohort.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(created.cohort.invite_code).toHaveLength(10);

    const joinedResponse = await postValidationCohort(request({ action: "join", code: created.cohort.invite_code, role: "target_user", consentVersion: "integration-v1" }));
    expect(joinedResponse.status).toBe(201);
    const joined = await body(joinedResponse);
    expect(joined.participant).toMatchObject({ cohort_id: created.cohort.id, user_id: auth.user.id, participant_role: "target_user" });
  });

  it("runs a fixed-order assessment and a verified pilot through the local API", async () => {
    const blueprintResponse = await postAssessment(request({
      action: "create_blueprint",
      roleKey: "product-manager",
      version: "integration-v1",
      rubricVersion: "rubric-v1",
      items: [
        { itemKey: "independent", poolKind: "assessment", stage: "independent_judgment", prompt: "写出判断和依据。", rubric: { evidence: true }, weight: 1 },
        { itemKey: "work-sample", poolKind: "assessment", stage: "ai_work_sample", prompt: "完成工作样本并说明取舍。", rubric: { tradeoff: true }, weight: 1 },
        { itemKey: "anchor", poolKind: "anchor", stage: "anchor_check", prompt: "回答锚题。", rubric: { consistency: true }, weight: 1 },
      ],
    }));
    expect(blueprintResponse.status).toBe(201);
    const blueprint = await body(blueprintResponse);
    const blueprintId = blueprint.blueprint.id as string;
    expect(blueprintId).toMatch(/^[0-9a-f-]{36}$/i);

    const startResponse = await postAssessment(request({ action: "start", blueprintId, mode: "pilot" }));
    expect(startResponse.status).toBe(201);
    const run = await body(startResponse);
    const runId = run.run.id as string;
    expect(run.run.item_order).toEqual(["independent", "work-sample", "anchor"]);

    const wrongOrder = await postAssessment(request({ action: "respond", runId, itemKey: "anchor", response: { answer: "跳题" } }));
    expect(wrongOrder.status).toBe(409);

    for (const itemKey of ["independent", "work-sample", "anchor"]) {
      const response = await postAssessment(request({ action: "respond", runId, itemKey, response: { answer: `${itemKey} response` } }));
      expect(response.status).toBe(200);
    }

    const evaluation = await postAssessment(request({ action: "evaluate", runId, itemKey: "independent", evaluatorType: "deterministic", score: 0.8, confidence: 0.9 }));
    expect(evaluation.status).toBe(201);
    const verifiedOrg = await postVerifiedAssessment(request({ action: "create_organization", name: "Local partner" }));
    expect(verifiedOrg.status).toBe(201);
    const organization = await body(verifiedOrg);
    const organizationId = organization.organization.id as string;
    const approvedOrg = await postVerifiedAssessment(request({ action: "approve_organization", organizationId, status: "approved" }));
    expect(approvedOrg.status).toBe(200);

    const sessionResponse = await postVerifiedAssessment(request({ action: "start", organizationId, assessmentRunId: runId, consentVersion: "verified-v1" }));
    expect(sessionResponse.status).toBe(201);
    const session = await body(sessionResponse);
    const sessionId = session.session.id as string;

    expect((await postVerifiedAssessment(request({ action: "identity", sessionId, status: "verified" }))).status).toBe(200);
    expect((await postVerifiedAssessment(request({ action: "environment", sessionId, environment: { browser: "Chromium", operatingSystem: "Windows", timezone: "Asia/Shanghai", policyVersion: "env-v1" } }))).status).toBe(200);
    expect((await postVerifiedAssessment(request({ action: "event", sessionId, event: { type: "item_submitted", payload: { itemKey: "independent" } } }))).status).toBe(200);
    expect((await postVerifiedAssessment(request({ action: "complete", sessionId }))).status).toBe(200);
    expect((await postVerifiedAssessment(request({ action: "human_review", sessionId, decision: "cleared", notes: "人工复核通过" }))).status).toBe(200);
    const reportResponse = await postVerifiedAssessment(request({ action: "report", sessionId, score: 0.74 }));
    expect(reportResponse.status).toBe(201);
    const report = await body(reportResponse);
    expect(report.report).toMatchObject({ session_id: sessionId, judgment_level: "consistent", usage_status: "pilot_only" });

    const assessmentReport = await postAssessment(request({ action: "report", runId }));
    expect(assessmentReport.status).toBe(201);
    expect((await body(assessmentReport)).report.report_status).toBe("diagnostic_only");
  });

  it("persists teams, mentor notes, governed content, and free billing state locally", async () => {
    const ownerId = "11111111-1111-4111-8111-111111111111";
    const learnerId = "22222222-2222-4222-8222-222222222222";
    auth.user.id = ownerId;

    const createdTeamResponse = await postTeam(request({ action: "create", name: "Local product team" }));
    expect(createdTeamResponse.status).toBe(201);
    const createdTeam = await body(createdTeamResponse);
    const teamId = createdTeam.team.id as string;

    const invitationResponse = await postTeam(request({ action: "invite", teamId, role: "learner" }));
    expect(invitationResponse.status).toBe(201);
    const invitation = await body(invitationResponse);
    const code = invitation.invitation.code as string;

    const noteResponse = await postTeam(request({ action: "mentor_note", teamId, sessionId: "local-session-1", content: "请在下一次判断中先说明证据缺口。" }));
    expect(noteResponse.status).toBe(201);
    const teamRead = await getTeam(new Request("http://localhost/api/teams?sessionId=local-session-1"));
    expect(teamRead.status).toBe(200);
    expect((await body(teamRead)).mentorNotes).toHaveLength(1);

    auth.user.id = learnerId;
    const joined = await postTeam(request({ action: "join", code }));
    expect(joined.status).toBe(200);
    expect((await body(joined)).team.team_members).toHaveLength(2);
    const forbiddenInvite = await postTeam(request({ action: "invite", teamId, role: "coach" }));
    expect(forbiddenInvite.status).toBe(400);

    auth.user.id = ownerId;
    const submittedCase = await postResource(request({ title: "证据优先的判断案例", industry: "企业软件", skillId: "evidence", summary: "用户先验证事实，再决定是否开发方案。", lesson: "在方案承诺前确认流程、影响和替代方案。" }));
    expect(submittedCase.status).toBe(201);
    const submitted = await body(submittedCase);
    const caseId = submitted.item.id as string;

    const beforePublish = await getResources(new Request("http://localhost/api/resources?type=community"));
    expect((await body(beforePublish)).items).toHaveLength(0);
    const published = await patchResource(request({ status: "published" }), { params: Promise.resolve({ id: caseId }) });
    expect(published.status).toBe(200);
    const afterPublish = await getResources(new Request("http://localhost/api/resources?type=community"));
    expect((await body(afterPublish)).items).toEqual([expect.objectContaining({ id: caseId, status: "published" })]);

    const knowledgeId = crypto.randomUUID();
    await withLocalRuntimeState((state) => {
      state.knowledgeEntries.push({ id: knowledgeId, title: "本地知识条目", industry: "企业软件", tags: ["证据"], content: "先确认用户流程和影响，再判断是否进入方案设计。", source: "integration", status: "review", reviewed_by: null, updated_at: new Date().toISOString() });
    });
    const knowledgeBefore = await getResources(new Request("http://localhost/api/resources?type=knowledge&q=本地知识"));
    expect((await body(knowledgeBefore)).items).toHaveLength(0);
    const knowledgePublished = await patchResource(request({ resourceType: "knowledge_entry", status: "published" }), { params: Promise.resolve({ id: knowledgeId }) });
    expect(knowledgePublished.status).toBe(200);
    const knowledgeAfter = await getResources(new Request("http://localhost/api/resources?type=knowledge&q=本地知识"));
    expect((await body(knowledgeAfter)).items).toEqual([expect.objectContaining({ id: knowledgeId, status: "published" })]);

    const billing = await getBilling();
    expect(billing.status).toBe(200);
    expect(await body(billing)).toMatchObject({ subscription: { plan_id: "free", status: "active", provider: null }, paymentConfigured: false });
  });
});
