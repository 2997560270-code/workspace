"use client";

import { useEffect, useMemo, useState } from "react";
import { COMMUNITY_CASES, KNOWLEDGE_ENTRIES, loadCommunityCases, saveCommunityCase, type CommunityCase, type KnowledgeEntry } from "../lib/resource-hub";
import { requestClientJson } from "../lib/client-api";
import { BillingPanel } from "./billing-panel";
import { ValidationLabPanel } from "./validation-lab-panel";
import { CommunityReviewPanel } from "./community-review-panel";
import { AssessmentLabPanel } from "./assessment-lab-panel";
import { VerifiedPilotPanel } from "./verified-pilot-panel";

type HubTab = "community" | "knowledge" | "admin" | "billing" | "validation" | "review-beta" | "assessment" | "verified";

type ApiCase = { id: string; title: string; industry: string; skill_id: string; summary: string; lesson: string; status: "pending" | "published" | "archived" | "rejected"; author_id?: string; created_at: string };

function mapApiCase(item: ApiCase): CommunityCase {
  return { id: item.id, title: item.title, industry: item.industry, skillId: "workflow", summary: item.summary, lesson: item.lesson, author: item.author_id ?? "服务端用户", status: item.status === "rejected" ? "archived" : item.status, createdAt: item.created_at };
}

export function ResourceHubPanel({ onClose, userId }: { onClose: () => void; userId: string }) {
  const [tab, setTab] = useState<HubTab>("community");
  const [query, setQuery] = useState("");
  const [cases, setCases] = useState<CommunityCase[]>(() => loadCommunityCases());
  const [remoteCases, setRemoteCases] = useState<CommunityCase[]>([]);
  const [remoteKnowledge, setRemoteKnowledge] = useState<KnowledgeEntry[]>([]);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [lesson, setLesson] = useState("");
  const [industry, setIndustry] = useState("");

  useEffect(() => {
    void requestClientJson<{ items: ApiCase[] }>("/api/resources?type=community").then((result) => {
      if (result?.items?.length) setRemoteCases(result.items.map(mapApiCase));
    });
  }, [userId]);

  useEffect(() => {
    const encoded = encodeURIComponent(query.trim());
    void requestClientJson<{ items: KnowledgeEntry[] }>(`/api/resources?type=knowledge${encoded ? `&q=${encoded}` : ""}`).then((result) => {
      if (result?.items?.length) setRemoteKnowledge(result.items);
    });
  }, [query, userId]);

  const allCases = useMemo(() => {
    const seen = new Set<string>();
    return [...COMMUNITY_CASES, ...cases, ...remoteCases].filter((item) => !seen.has(item.id) && seen.add(item.id));
  }, [cases, remoteCases]);
  const knowledgeEntries = remoteKnowledge.length ? remoteKnowledge : KNOWLEDGE_ENTRIES;
  const filteredKnowledge = knowledgeEntries.filter((entry) => !query.trim() || [entry.title, entry.industry, entry.content, ...entry.tags].some((value) => value.includes(query.trim())));

  async function submitCase() {
    if ([title, summary, lesson, industry].some((value) => value.trim().length < 4)) return;
    const remote = await requestClientJson<{ item: ApiCase }>("/api/resources", { method: "POST", body: JSON.stringify({ title: title.trim(), industry: industry.trim(), skillId: "workflow", summary: summary.trim(), lesson: lesson.trim() }) });
    if (remote?.item) setRemoteCases((current) => [mapApiCase(remote.item), ...current]);
    else {
      const next = saveCommunityCase({ title: title.trim(), summary: summary.trim(), lesson: lesson.trim(), industry: industry.trim(), skillId: "workflow", author: "本地用户" });
      setCases((current) => [...current, next]);
    }
    setTitle(""); setSummary(""); setLesson(""); setIndustry("");
  }

  async function updateStatus(id: string, status: CommunityCase["status"]) {
    if (status !== "pending") {
      const remote = await requestClientJson<{ item: ApiCase }>(`/api/admin/resources/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      if (remote?.item) setRemoteCases((current) => current.map((item) => item.id === id ? mapApiCase(remote.item) : item));
    }
    setCases((current) => {
      const next = current.map((item) => item.id === id ? { ...item, status } : item);
      if (typeof window !== "undefined") window.localStorage.setItem("product-drill-community-cases-v1", JSON.stringify(next));
      return next;
    });
  }

  return (
    <div className="resource-hub-shell">
      <section className="surface resource-hub-intro"><div className="section-heading"><div><span className="section-kicker">资源中心</span><h2>案例、知识与内容管理</h2></div><button className="back-button" onClick={onClose} type="button">← 返回训练地图</button></div><p>社区和行业资料先在本地验证内容结构；正式发布前需要账号权限、审核流程和来源治理。</p></section>
      <div className="resource-tabs" role="tablist"><button aria-selected={tab === "community"} className={tab === "community" ? "active" : ""} onClick={() => setTab("community")} role="tab" type="button">社区案例</button><button aria-selected={tab === "knowledge"} className={tab === "knowledge" ? "active" : ""} onClick={() => setTab("knowledge")} role="tab" type="button">行业知识库</button><button aria-selected={tab === "admin"} className={tab === "admin" ? "active" : ""} onClick={() => setTab("admin")} role="tab" type="button">内容管理</button><button aria-selected={tab === "billing"} className={tab === "billing" ? "active" : ""} onClick={() => setTab("billing")} role="tab" type="button">计划与订阅</button><button aria-selected={tab === "validation"} className={tab === "validation" ? "active" : ""} onClick={() => setTab("validation")} role="tab" type="button">验证实验室</button><button aria-selected={tab === "review-beta"} className={tab === "review-beta" ? "active" : ""} onClick={() => setTab("review-beta")} role="tab" type="button">社区盲评 Beta</button><button aria-selected={tab === "assessment"} className={tab === "assessment" ? "active" : ""} onClick={() => setTab("assessment")} role="tab" type="button">标准化考核</button><button aria-selected={tab === "verified"} className={tab === "verified" ? "active" : ""} onClick={() => setTab("verified")} role="tab" type="button">受验证试点</button></div>
      {tab === "community" ? <div className="resource-community"><section className="surface resource-case-list" data-testid="community-case-list"><div className="section-heading"><div><span className="section-kicker">已发布案例</span><h2>从他人的判断中学习</h2></div></div>{allCases.filter((item) => item.status === "published").map((item) => <article key={item.id}><span>{item.industry}</span><h3>{item.title}</h3><p>{item.summary}</p><strong>练习启发：{item.lesson}</strong></article>)}</section><section className="surface resource-submit"><span className="section-kicker">分享案例</span><h2>提交一个值得复盘的判断</h2><label><span>标题</span><input aria-label="案例标题" onChange={(event) => setTitle(event.target.value)} value={title} /></label><label><span>行业</span><input aria-label="案例行业" onChange={(event) => setIndustry(event.target.value)} value={industry} /></label><label><span>发生了什么</span><textarea aria-label="案例摘要" onChange={(event) => setSummary(event.target.value)} rows={3} value={summary} /></label><label><span>你学到了什么</span><textarea aria-label="案例启发" onChange={(event) => setLesson(event.target.value)} rows={3} value={lesson} /></label><button className="button button-primary" disabled={[title, industry, summary, lesson].some((value) => value.trim().length < 4)} onClick={submitCase} type="button">提交待审核案例</button></section></div> : null}
      {tab === "knowledge" ? <section className="surface resource-knowledge" data-testid="knowledge-list"><div className="section-heading"><div><span className="section-kicker">检索资料</span><h2>行业知识库</h2></div><input aria-label="搜索知识库" onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题、行业或标签" value={query} /></div><div className="knowledge-grid">{filteredKnowledge.map((entry) => <article key={entry.id}><span>{entry.industry}</span><h3>{entry.title}</h3><p>{entry.content}</p><small>{entry.tags.join(" · ")} · 来源：{entry.source}</small></article>)}</div>{!filteredKnowledge.length ? <p className="empty-state-copy">没有匹配的资料。</p> : null}</section> : null}
      {tab === "admin" ? <section className="surface resource-admin" data-testid="resource-admin"><div className="section-heading"><div><span className="section-kicker">审核队列</span><h2>社区内容管理</h2></div><span className="status-tag">本地管理员预览</span></div><p>正式版本需要服务端管理员角色和审计日志；这里仅验证审核状态流转。</p>{cases.length ? cases.map((item) => <article key={item.id}><div><strong>{item.title}</strong><small>{item.author} · {item.status}</small></div><div><button className="text-button" onClick={() => updateStatus(item.id, "published")} type="button">发布</button><button className="text-button" onClick={() => updateStatus(item.id, "archived")} type="button">归档</button></div></article>) : <p>暂无待审核内容。</p>}</section> : null}
      {tab === "billing" ? <BillingPanel userId={userId} /> : null}
      {tab === "validation" ? <ValidationLabPanel userId={userId} /> : null}
      {tab === "review-beta" ? <CommunityReviewPanel userId={userId} /> : null}
      {tab === "assessment" ? <AssessmentLabPanel /> : null}
      {tab === "verified" ? <VerifiedPilotPanel /> : null}
    </div>
  );
}
