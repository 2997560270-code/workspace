"use client";

import { useEffect, useMemo, useState } from "react";
import { MULTI_ROLE_SCENARIOS } from "../lib/multi-role-training";
import { requestClientJson } from "../lib/client-api";

type Message = { id: string; author: "user" | "role"; content: string; created_at: string };
type MultiRoleSession = { id: string; scenario_id: string; role_id: string; messages: Message[] };
type SessionResponse = { session: MultiRoleSession; resumed?: boolean; configured?: boolean };

export function MultiRolePanel({ onClose }: { onClose: () => void }) {
  const scenario = MULTI_ROLE_SCENARIOS[0];
  const [roleId, setRoleId] = useState(scenario.roles[0].id);
  const [input, setInput] = useState("");
  const [session, setSession] = useState<MultiRoleSession | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const role = useMemo(() => scenario.roles.find((item) => item.id === roleId) ?? scenario.roles[0], [roleId, scenario.roles]);

  useEffect(() => {
    let cancelled = false;
    setSession(null);
    setInput("");
    setError("");
    setLoadingSession(true);
    void requestClientJson<SessionResponse>("/api/multi-role/sessions", {
      method: "POST",
      body: JSON.stringify({ action: "start", scenarioId: scenario.id, roleId, resume: true }),
    }).then((response) => {
      if (cancelled) return;
      if (!response?.session) setError("多人角色会话暂时无法建立，请稍后重试。");
      else setSession(response.session);
      setLoadingSession(false);
    });
    return () => { cancelled = true; };
  }, [roleId, scenario.id]);

  function switchRole(nextRoleId: string) {
    setRoleId(nextRoleId);
  }

  async function send() {
    const question = input.trim();
    if (!question || !session || sending) return;
    setSending(true);
    setError("");
    const response = await requestClientJson<SessionResponse>("/api/multi-role/sessions", {
      method: "POST",
      body: JSON.stringify({ action: "message", sessionId: session.id, content: question }),
    });
    if (!response?.session) {
      setError("消息没有保存成功，请检查服务后重试。");
    } else {
      setSession(response.session);
      setInput("");
    }
    setSending(false);
  }

  async function startNewConversation() {
    if (loadingSession || sending) return;
    setLoadingSession(true);
    setError("");
    const response = await requestClientJson<SessionResponse>("/api/multi-role/sessions", {
      method: "POST",
      body: JSON.stringify({ action: "start", scenarioId: scenario.id, roleId, resume: false }),
    });
    if (!response?.session) setError("新对话暂时无法建立，请稍后重试。");
    else {
      setSession(response.session);
      setInput("");
    }
    setLoadingSession(false);
  }

  return (
    <div className="multi-role-shell">
      <section className="surface multi-role-intro"><div className="section-heading"><div><span className="section-kicker">多人角色训练</span><h2>{scenario.title}</h2></div><button className="back-button" onClick={onClose} type="button">← 返回训练地图</button></div><p>{scenario.context}</p><span className="multi-role-boundary">每个角色的会话会独立保存；这些练习不会计入正式能力趋势。</span></section>
      <div className="multi-role-layout">
        <aside className="surface multi-role-list"><span className="section-kicker">选择角色</span>{scenario.roles.map((item) => <button className={item.id === role.id ? "active" : ""} key={item.id} onClick={() => switchRole(item.id)} type="button"><strong>{item.name}</strong><small>{item.objective}</small></button>)}</aside>
        <section className="surface multi-role-conversation" data-testid="multi-role-conversation"><div className="conversation-head"><div><span className="section-kicker">当前角色</span><h2>{role.name}</h2></div><div><span className="quiet">{role.objective}</span><button className="text-button" disabled={loadingSession || sending} onClick={startNewConversation} type="button">新建对话</button></div></div><div className="multi-role-messages">{session?.messages.map((message) => <article className={`message ${message.author === "user" ? "user" : "ai"}`} key={message.id}><span>{message.author === "user" ? "你" : role.name}</span><p>{message.content}</p></article>)}{loadingSession ? <p aria-live="polite" className="quiet">正在恢复角色会话…</p> : null}{sending ? <p aria-live="polite" className="quiet">正在保存你的问题并生成角色回复…</p> : null}{error ? <p aria-live="polite" className="runtime-error">{error}</p> : null}</div><div className="multi-role-composer"><textarea aria-label="多人角色追问" disabled={!session || loadingSession || sending} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder="向当前角色提一个具体问题" rows={3} value={input} /><button className="button button-primary" disabled={!input.trim() || !session || loadingSession || sending} onClick={() => void send()} type="button">{sending ? "正在回复…" : "发送追问"}</button></div></section>
      </div>
    </div>
  );
}
