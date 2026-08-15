import { describe, expect, it } from "vitest";
import { buildDiagnosticAssessmentReport, createAssessmentBlueprint, publishAssessmentBlueprint, startAssessmentRun, submitAssessmentResponse } from "../src/lib/standardized-assessment";

describe("standardized assessment research", () => {
  const blueprint = publishAssessmentBlueprint(createAssessmentBlueprint({ roleKey: "product-manager", version: "pilot-v1", rubricVersion: "rubric-v1", items: [
    { itemKey: "judgment-1", poolKind: "assessment", stage: "independent_judgment", prompt: "判断", rubric: { evidence: true }, weight: 1 },
    { itemKey: "work-1", poolKind: "assessment", stage: "ai_work_sample", prompt: "工作样本", rubric: { tradeoff: true }, weight: 1 },
    { itemKey: "anchor-1", poolKind: "anchor", stage: "anchor_check", prompt: "锚题", rubric: { consistency: true }, weight: 1 },
  ] }));

  it("keeps training and experiment pools out of the blueprint", () => {
    expect(() => createAssessmentBlueprint({ roleKey: "pm", version: "v1", rubricVersion: "r1", items: [{ itemKey: "bad", poolKind: "training" as never, stage: "independent_judgment", prompt: "x", rubric: {}, weight: 1 }] })).toThrow(/Training/);
    expect(blueprint.status).toBe("pilot");
  });

  it("uses a fixed item order and rejects adaptive or out-of-order responses", () => {
    let run = startAssessmentRun(blueprint, "user-1");
    expect(() => submitAssessmentResponse(run, blueprint, "work-1", { answer: "x" })).toThrow(/fixed order/);
    run = submitAssessmentResponse(run, blueprint, "judgment-1", { answer: "x" });
    run = submitAssessmentResponse(run, blueprint, "work-1", { answer: "y" });
    run = submitAssessmentResponse(run, blueprint, "anchor-1", { answer: "z" });
    expect(run.status).toBe("submitted");
  });

  it("reports independent and work-sample evidence separately with an uncertainty interval", () => {
    let run = startAssessmentRun(blueprint, "user-1");
    run = submitAssessmentResponse(run, blueprint, "judgment-1", { answer: "x" });
    run = submitAssessmentResponse(run, blueprint, "work-1", { answer: "y" });
    run = submitAssessmentResponse(run, blueprint, "anchor-1", { answer: "z" });
    const report = buildDiagnosticAssessmentReport(run, [{ itemKey: "judgment-1", score: 0.8, evaluatorType: "human" }, { itemKey: "work-1", score: 0.6, evaluatorType: "ai" }, { itemKey: "anchor-1", score: 0.7, evaluatorType: "human" }]);
    expect(report.independentScore).toBe(0.8);
    expect(report.workSampleScore).toBe(0.6);
    expect(report.confidenceInterval.low).toBeLessThanOrEqual(0.8);
    expect(report.confidenceInterval.high).toBeGreaterThanOrEqual(0.8);
    expect(report.reportStatus).toBe("diagnostic_only");
  });
});
