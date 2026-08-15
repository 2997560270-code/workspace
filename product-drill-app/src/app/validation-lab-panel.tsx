"use client";

import { useState } from "react";
import { createReview, createValidationCohort, loadValidationState, saveValidationState, type ValidationState } from "../lib/validation-lab";

export function ValidationLabPanel({ userId }: { userId: string }) {
  const [state, setState] = useState<ValidationState>(() => loadValidationState());
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [confidence, setConfidence] = useState<"high" | "medium" | "low">("medium");
  const cohort = state.cohorts[0];

  function persist(next: ValidationState) { saveValidationState(next); setState(next); }
  function create() { if (name.trim().length < 2) return; persist({ ...state, cohorts: [createValidationCohort(name), ...state.cohorts] }); setName(""); }
  function submitReview() {
    if (!cohort || reason.trim().length < 20) return;
    const review = createReview({ cohortId: cohort.id, reviewerId: userId, subject: "匿名锚例 A-01", rubric: { evidenceTraceability: "meets", prematureCommitment: "observed" }, reason: reason.trim(), confidence });
    persist({ ...state, reviews: [review, ...state.reviews] }); setReason("");
  }

  return <section className="surface validation-lab" data-testid="validation-lab"><div className="section-heading"><div><span className="section-kicker">阶段 2 验证实验室</span><h2>邀请制验证与隐藏锚例</h2></div><span className="status-tag">本地试验控制台</span></div><p className="validation-boundary">这里管理封闭试验、合作评审和基线记录；真实招募与独立评审仍需要外部参与者。</p>{cohort ? <div className="validation-grid"><article className="validation-cohort"><span>当前批次</span><h3>{cohort.name}</h3><strong data-testid="validation-invite-code">{cohort.inviteCode}</strong><p>{cohort.status} · {cohort.participants.length} 位参与者</p></article><article className="validation-review"><span>盲评任务</span><h3>匿名锚例 A-01</h3><p>评审者不会看到锚例身份或预期结论。请依据 Rubric、证据和理由提交独立判断。</p><label><span>置信度</span><select aria-label="盲评置信度" onChange={(event) => setConfidence(event.target.value as typeof confidence)} value={confidence}><option value="high">高</option><option value="medium">中</option><option value="low">低</option></select></label><label><span>证据化理由</span><textarea aria-label="盲评理由" onChange={(event) => setReason(event.target.value)} placeholder="至少 20 个字，说明判断、证据和不确定性" rows={4} value={reason} /></label><button className="button button-primary" disabled={reason.trim().length < 20} onClick={submitReview} type="button">提交独立盲评</button></article><article className="validation-metrics"><span>验证基线</span><h3>尚未用真人数据形成结论</h3><div><strong>{state.reviews.length}</strong><small>独立评审</small></div><div><strong>{state.metrics.length}</strong><small>基线测量</small></div><p>重复性、用户理解、迁移和评审一致性必须由真实试验数据计算。</p></article></div> : <div className="validation-create"><label><span>验证批次名称</span><input aria-label="验证批次名称" onChange={(event) => setName(event.target.value)} placeholder="例如：产品新人封闭试验 01" value={name} /></label><button className="button button-primary" disabled={name.trim().length < 2} onClick={create} type="button">创建邀请制批次</button></div>}</section>;
}
