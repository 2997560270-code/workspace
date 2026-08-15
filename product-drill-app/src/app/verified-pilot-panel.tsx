"use client";

import { useState } from "react";
import { appendVerifiedProcessEvent, buildVerifiedReport, clearHumanReview, completeVerifiedSession, recordEnvironment, recordManualIdentity, startVerifiedSession, type VerifiedReport, type VerifiedSession } from "../lib/verified-pilot";

export function VerifiedPilotPanel() {
  const [session, setSession] = useState<VerifiedSession | null>(null);
  const [report, setReport] = useState<VerifiedReport | null>(null);

  function start() { setSession(startVerifiedSession({ organization: { id: "local-partner", name: "本地合作机构演示", status: "approved" }, assessmentRunId: "local-assessment", participantId: "local-user", consentVersion: "verified-pilot-v1", runSubmitted: true })); setReport(null); }
  function verify() { if (session) setSession(recordManualIdentity(session, "verified", "local-human-reviewer")); }
  function record() { if (session) setSession(recordEnvironment(session, { browser: "Chromium", operatingSystem: "Windows", timezone: "Asia/Shanghai", policyVersion: "env-v1" })); }
  function complete() { if (session) setSession(completeVerifiedSession(appendVerifiedProcessEvent(session, { type: "item_submitted", payload: { itemKey: "assessment-item-1" } }))); }
  function review() { if (session) { const next = clearHumanReview(session, "local-human-reviewer", "cleared"); setSession(next); setReport(buildVerifiedReport(next, 0.74)); } }

  return <section className="surface validation-lab" data-testid="verified-pilot"><div className="section-heading"><div><span className="section-kicker">阶段 6 受验证考核试点</span><h2>合作机构场次与人工复核</h2></div><span className="status-tag">仅限试点</span></div><p className="validation-boundary">正式场次必须由已批准合作机构发起；记录声明的环境和过程，不启用自动摄像头或生物识别。</p>{!session ? <button className="button button-primary" onClick={start} type="button">开始本地试点演示</button> : <div className="validation-grid"><article className="validation-cohort"><span>场次状态</span><h3>{session.processStatus}</h3><p>身份：{session.identityStatus}<br />环境：{session.environmentStatus}<br />人工复核：{session.humanReviewStatus}</p><button className="button button-secondary" disabled={session.identityStatus !== "pending_manual"} onClick={verify} type="button">完成人工身份核验</button><button className="button button-secondary" disabled={session.identityStatus === "pending_manual" || session.environmentStatus === "recorded"} onClick={record} type="button">记录环境声明</button></article><article className="validation-review"><span>过程记录</span><h3>固定考核过程</h3><p>已记录 {session.events.length} 个过程事件。完成后进入人工复核队列。</p><button className="button button-primary" disabled={session.environmentStatus !== "recorded" || session.processStatus !== "in_progress"} onClick={complete} type="button">结束场次并排队复核</button><button className="button button-secondary" disabled={session.humanReviewStatus !== "queued"} onClick={review} type="button">人工复核通过</button></article><article className="validation-metrics"><span>输出边界</span><h3>{report ? `${report.judgmentLevel} · ${report.usageStatus}` : "尚未生成报告"}</h3><p>{report?.limitations.join(" ") ?? "只有人工复核通过后才生成受验证试点报告。"}</p></article></div>}</section>;
}
