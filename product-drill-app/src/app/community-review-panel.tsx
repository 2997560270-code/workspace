"use client";

import { useMemo, useState } from "react";
import { aggregateCommunityReviews, assignRandomReview, createReviewPoolEntry, type RawCommunityReview, type ReviewAggregate, type ReviewAssignment, type ReviewPoolEntry } from "../lib/community-review";

type LocalReviewState = { pool: ReviewPoolEntry[]; assignments: ReviewAssignment[]; reviews: RawCommunityReview[]; aggregate: ReviewAggregate | null };
const STORAGE_KEY = "product-drill-community-review-beta-v1";

function loadState(): LocalReviewState {
  if (typeof window === "undefined") return { pool: [], assignments: [], reviews: [], aggregate: null };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<LocalReviewState> | null;
    return { pool: Array.isArray(parsed?.pool) ? parsed.pool : [], assignments: Array.isArray(parsed?.assignments) ? parsed.assignments : [], reviews: Array.isArray(parsed?.reviews) ? parsed.reviews : [], aggregate: parsed?.aggregate ?? null };
  } catch { return { pool: [], assignments: [], reviews: [], aggregate: null }; }
}

export function CommunityReviewPanel({ userId }: { userId: string }) {
  const [state, setState] = useState<LocalReviewState>(() => loadState());
  const [reason, setReason] = useState("");
  const [confidence, setConfidence] = useState<"high" | "medium" | "low">("medium");
  const activeAssignment = useMemo(() => state.assignments.find((item) => item.reviewerId === userId && item.status !== "submitted" && !item.conflictDeclared), [state.assignments, userId]);

  function persist(next: LocalReviewState) {
    setState(next);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function seedPool() {
    if (state.pool.length) return;
    const nextPool = [
      createReviewPoolEntry({ id: "pool-demo-1", cohortId: "local-cohort", subjectUserId: "another-user", decisionEventId: "decision-demo-1", conflictGroup: "company-a" }),
      createReviewPoolEntry({ id: "pool-demo-2", cohortId: "local-cohort", subjectUserId: "third-user", anchorCaseId: "anchor-demo-1" }),
    ];
    persist({ ...state, pool: nextPool });
  }

  function assign() {
    seedPool();
    const pool = state.pool.length ? state.pool : [
      createReviewPoolEntry({ id: "pool-demo-1", cohortId: "local-cohort", subjectUserId: "another-user", decisionEventId: "decision-demo-1", conflictGroup: "company-a" }),
      createReviewPoolEntry({ id: "pool-demo-2", cohortId: "local-cohort", subjectUserId: "third-user", anchorCaseId: "anchor-demo-1" }),
    ];
    const assignment = assignRandomReview({ reviewerId: userId, pool, existingAssignments: state.assignments });
    if (assignment) persist({ ...state, pool, assignments: [...state.assignments, assignment] });
  }

  function submit() {
    if (!activeAssignment || reason.trim().length < 20) return;
    const review: RawCommunityReview = { id: `review-${crypto.randomUUID()}`, assignmentId: activeAssignment.id, rubric: { evidenceTraceability: "meets", independentJudgment: "review" }, evidenceIds: ["event-demo-1"], reason: reason.trim(), confidence };
    const reviews = [...state.reviews, review];
    const assignments = state.assignments.map((item) => item.id === activeAssignment.id ? { ...item, status: "submitted" as const } : item);
    persist({ ...state, reviews, assignments, aggregate: aggregateCommunityReviews(reviews) });
    setReason("");
  }

  return <section className="surface validation-lab" data-testid="community-review-beta"><div className="section-heading"><div><span className="section-kicker">阶段 3 社区盲评 Beta</span><h2>匿名派题与分歧保留</h2></div><span className="status-tag">本地试验控制台</span></div><p className="validation-boundary">本地入口只验证数据结构和流程；真实评审需要通过服务端验证批次和参与者权限。</p><div className="validation-grid"><article className="validation-cohort"><span>待评池</span><h3>{state.pool.length} 个匿名条目</h3><p>评审接口只看到匿名主体编号，不返回提交者身份。</p><button className="button button-secondary" onClick={seedPool} type="button">准备本地锚例</button><button className="button button-primary" disabled={Boolean(activeAssignment)} onClick={assign} type="button">随机领取评审</button></article><article className="validation-review"><span>当前盲评</span><h3>{activeAssignment ? activeAssignment.anonymizedSubjectId : "尚未领取任务"}</h3>{activeAssignment ? <><p>请仅依据 Rubric、证据 ID 和自己的理由提交判断。</p><label><span>置信度</span><select aria-label="社区盲评置信度" onChange={(event) => setConfidence(event.target.value as typeof confidence)} value={confidence}><option value="high">高</option><option value="medium">中</option><option value="low">低</option></select></label><label><span>证据化理由</span><textarea aria-label="社区盲评理由" onChange={(event) => setReason(event.target.value)} placeholder="至少 20 个字，说明证据、理由和不确定性" rows={4} value={reason} /></label><button className="button button-primary" disabled={reason.trim().length < 20} onClick={submit} type="button">提交原始盲评</button></> : <p>领取任务后才会显示匿名主体。</p>}</article><article className="validation-metrics"><span>汇总边界</span><h3>{state.aggregate?.status === "needs_re_review" ? "存在分歧，需要复审" : "暂未形成汇总"}</h3><div><strong>{state.reviews.length}</strong><small>原始评审</small></div><div><strong>{state.aggregate?.disagreement.fields.length ?? 0}</strong><small>分歧维度</small></div><p>{state.aggregate?.summary ?? "AI 汇总也必须保留原始评审和分歧，不能直接覆盖。"}</p></article></div></section>;
}
