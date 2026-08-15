import { z } from "zod";

export const AssessmentStageSchema = z.enum(["independent_judgment", "ai_work_sample", "anchor_check"]);
export type AssessmentStage = z.infer<typeof AssessmentStageSchema>;
export type AssessmentItem = { itemKey: string; poolKind: "assessment" | "anchor"; stage: AssessmentStage; prompt: string; rubric: Record<string, unknown>; weight: number };
export type AssessmentBlueprint = { id: string; roleKey: string; version: string; rubricVersion: string; items: AssessmentItem[]; status: "draft" | "pilot" | "retired" };
export type AssessmentResponse = { itemKey: string; stage: AssessmentStage; response: Record<string, unknown>; submittedAt: string };
export type AssessmentRun = { id: string; blueprintId: string; userId: string; mode: "pilot" | "verified"; itemOrder: string[]; currentIndex: number; status: "in_progress" | "submitted" | "reviewing" | "reported" | "withdrawn"; responses: AssessmentResponse[] };
export type AssessmentReport = { runId: string; independentScore: number; workSampleScore: number | null; confidenceInterval: { low: number; high: number }; limitations: string[]; reportStatus: "diagnostic_only" | "pilot_review" | "withdrawn" };

function id(prefix: string) { return `${prefix}-${crypto.randomUUID()}`; }

export function createAssessmentBlueprint(input: Omit<AssessmentBlueprint, "id" | "status">): AssessmentBlueprint {
  if (!input.items.length) throw new Error("Assessment blueprint needs items");
  const keys = new Set<string>();
  for (const item of input.items) {
    if (keys.has(item.itemKey)) throw new Error("Assessment item keys must be unique");
    keys.add(item.itemKey);
    if (!Number.isFinite(item.weight) || item.weight <= 0) throw new Error("Assessment item weight must be positive");
    if (item.poolKind !== "assessment" && item.poolKind !== "anchor") throw new Error("Training and experiment pools cannot enter an assessment blueprint");
  }
  return { ...input, id: id("blueprint"), status: "draft" };
}

export function publishAssessmentBlueprint(blueprint: AssessmentBlueprint): AssessmentBlueprint {
  if (blueprint.items.some((item) => item.stage === "anchor_check") && !blueprint.items.some((item) => item.poolKind === "anchor")) throw new Error("Anchor stage requires an anchor pool item");
  return { ...blueprint, status: "pilot" };
}

export function startAssessmentRun(blueprint: AssessmentBlueprint, userId: string, mode: "pilot" | "verified" = "pilot"): AssessmentRun {
  if (blueprint.status !== "pilot") throw new Error("Only a pilot blueprint can start a run");
  return { id: id("assessment"), blueprintId: blueprint.id, userId, mode, itemOrder: blueprint.items.map((item) => item.itemKey), currentIndex: 0, status: "in_progress", responses: [] };
}

export function submitAssessmentResponse(run: AssessmentRun, blueprint: AssessmentBlueprint, itemKey: string, response: Record<string, unknown>, submittedAt = new Date().toISOString()): AssessmentRun {
  if (run.status !== "in_progress") throw new Error("Assessment run is not accepting responses");
  const expectedKey = run.itemOrder[run.currentIndex];
  if (itemKey !== expectedKey) throw new Error("Assessment items must be completed in fixed order");
  if (run.responses.some((item) => item.itemKey === itemKey)) throw new Error("Assessment item already answered");
  const item = blueprint.items.find((candidate) => candidate.itemKey === itemKey);
  if (!item) throw new Error("Assessment item is not in the blueprint");
  const responses = [...run.responses, { itemKey, stage: item.stage, response, submittedAt }];
  const complete = responses.length === run.itemOrder.length;
  return { ...run, responses, currentIndex: run.currentIndex + 1, status: complete ? "submitted" : "in_progress" };
}

function average(values: number[]) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null; }

export function buildDiagnosticAssessmentReport(run: AssessmentRun, evaluations: Array<{ itemKey: string; score: number; evaluatorType: "human" | "ai" | "deterministic" }>): AssessmentReport {
  const independent = evaluations.filter((item) => run.responses.find((response) => response.itemKey === item.itemKey)?.stage === "independent_judgment").map((item) => item.score);
  const workSample = evaluations.filter((item) => run.responses.find((response) => response.itemKey === item.itemKey)?.stage === "ai_work_sample").map((item) => item.score);
  const independentScore = average(independent) ?? 0;
  const standardError = independent.length ? Math.sqrt(Math.max(0, independentScore * (1 - independentScore)) / independent.length) : 1;
  const margin = Math.min(0.5, 1.96 * standardError);
  return { runId: run.id, independentScore, workSampleScore: average(workSample), confidenceInterval: { low: Math.max(0, independentScore - margin), high: Math.min(1, independentScore + margin) }, limitations: ["这是诊断性试点报告，不是招聘合格线。", "当前样本不能证明岗位效度、公平性或跨群体等值性。", "AI 工作样本与独立判断分开报告，不能互相替代。"], reportStatus: "diagnostic_only" };
}
