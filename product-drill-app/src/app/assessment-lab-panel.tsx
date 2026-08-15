"use client";

import { useMemo, useState } from "react";
import { buildDiagnosticAssessmentReport, createAssessmentBlueprint, publishAssessmentBlueprint, startAssessmentRun, submitAssessmentResponse, type AssessmentRun } from "../lib/standardized-assessment";

const blueprint = publishAssessmentBlueprint(createAssessmentBlueprint({ roleKey: "product-manager", version: "pilot-v1", rubricVersion: "rubric-v1", items: [
  { itemKey: "independent-judgment", poolKind: "assessment", stage: "independent_judgment", prompt: "请先写出你的判断、依据和不确定性。", rubric: { evidence: true }, weight: 1 },
  { itemKey: "ai-work-sample", poolKind: "assessment", stage: "ai_work_sample", prompt: "请在明确约束下完成一个工作样本，并说明取舍。", rubric: { tradeoff: true }, weight: 1 },
  { itemKey: "anchor-check", poolKind: "anchor", stage: "anchor_check", prompt: "请独立回答一条锚题，用于检查判断一致性。", rubric: { consistency: true }, weight: 1 },
] }));

export function AssessmentLabPanel() {
  const [run, setRun] = useState<AssessmentRun | null>(null);
  const [answer, setAnswer] = useState("");
  const [report, setReport] = useState<ReturnType<typeof buildDiagnosticAssessmentReport> | null>(null);
  const currentItem = useMemo(() => blueprint.items.find((item) => item.itemKey === run?.itemOrder[run.currentIndex]), [run]);

  function start() { setRun(startAssessmentRun(blueprint, "local-user")); setReport(null); }
  function submit() {
    if (!run || !currentItem || answer.trim().length < 4) return;
    const next = submitAssessmentResponse(run, blueprint, currentItem.itemKey, { answer: answer.trim() });
    setRun(next); setAnswer("");
    if (next.status === "submitted") setReport(buildDiagnosticAssessmentReport(next, next.responses.map((response) => ({ itemKey: response.itemKey, score: response.stage === "independent_judgment" ? 0.7 : 0.6, evaluatorType: response.stage === "ai_work_sample" ? "ai" as const : "deterministic" as const }))));
  }

  return <section className="surface validation-lab" data-testid="assessment-lab"><div className="section-heading"><div><span className="section-kicker">阶段 5 标准化考核研发</span><h2>固定题序诊断试点</h2></div><span className="status-tag">仅诊断，不是招聘结论</span></div><p className="validation-boundary">训练、试验、考核和锚题池彼此隔离；独立判断与 AI 工作样本分开记录。</p>{!run ? <button className="button button-primary" onClick={start} type="button">开始标准化试点</button> : report ? <div className="validation-grid"><article className="validation-cohort"><span>独立判断</span><h3>{Math.round(report.independentScore * 100)}%</h3><p>区间 {Math.round(report.confidenceInterval.low * 100)}%–{Math.round(report.confidenceInterval.high * 100)}%</p></article><article className="validation-review"><span>工作样本</span><h3>{report.workSampleScore === null ? "暂无" : `${Math.round(report.workSampleScore * 100)}%`}</h3><p>该结果与独立判断分开呈现，不合并成招聘分数。</p><button className="button button-secondary" onClick={start} type="button">重新开始试点</button></article><article className="validation-metrics"><span>报告边界</span><h3>诊断性报告</h3>{report.limitations.map((item) => <p key={item}>{item}</p>)}</article></div> : <div className="validation-grid"><article className="validation-cohort"><span>进度</span><h3>{run.currentIndex + 1} / {run.itemOrder.length}</h3><p>题序固定，不能跳题或自适应换题。</p></article><article className="validation-review"><span>{currentItem?.stage}</span><h3>{currentItem?.prompt}</h3><textarea aria-label="标准化考核回答" onChange={(event) => setAnswer(event.target.value)} rows={6} value={answer} /><button className="button button-primary" disabled={answer.trim().length < 4} onClick={submit} type="button">提交当前回答</button></article><article className="validation-metrics"><span>独立性边界</span><h3>不显示即时分数</h3><p>评分在完成后由受控流程产生，AI 工作样本不会改变独立判断题。</p></article></div>}</section>;
}
