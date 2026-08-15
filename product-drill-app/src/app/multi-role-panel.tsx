"use client";

import { useMemo, useState } from "react";
import { answerMultiRoleQuestion, MULTI_ROLE_SCENARIOS } from "../lib/multi-role-training";

type Message = { id: number; role: "user" | "ai"; content: string };

export function MultiRolePanel({ onClose }: { onClose: () => void }) {
  const scenario = MULTI_ROLE_SCENARIOS[0];
  const [roleId, setRoleId] = useState(scenario.roles[0].id);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const role = useMemo(() => scenario.roles.find((item) => item.id === roleId) ?? scenario.roles[0], [roleId, scenario.roles]);

  function switchRole(nextRoleId: string) {
    setRoleId(nextRoleId);
    setMessages([]);
  }

  function send() {
    const question = input.trim();
    if (!question) return;
    setMessages((current) => [...current, { id: Date.now(), role: "user", content: question }, { id: Date.now() + 1, role: "ai", content: answerMultiRoleQuestion(role, question) }]);
    setInput("");
  }

  return (
    <div className="multi-role-shell">
      <section className="surface multi-role-intro"><div className="section-heading"><div><span className="section-kicker">多人角色训练</span><h2>{scenario.title}</h2></div><button className="back-button" onClick={onClose} type="button">← 返回训练地图</button></div><p>{scenario.context}</p><span className="multi-role-boundary">本地演示：切换角色后重新提问，结果不计入正式能力趋势。</span></section>
      <div className="multi-role-layout">
        <aside className="surface multi-role-list"><span className="section-kicker">选择角色</span>{scenario.roles.map((item) => <button className={item.id === role.id ? "active" : ""} key={item.id} onClick={() => switchRole(item.id)} type="button"><strong>{item.name}</strong><small>{item.objective}</small></button>)}</aside>
        <section className="surface multi-role-conversation" data-testid="multi-role-conversation"><div className="conversation-head"><div><span className="section-kicker">当前角色</span><h2>{role.name}</h2></div><span className="quiet">{role.objective}</span></div><div className="multi-role-opening"><span>{role.name}</span><p>{role.opening}</p></div><div className="multi-role-messages">{messages.map((message) => <article className={`message ${message.role}`} key={message.id}><span>{message.role === "user" ? "你" : role.name}</span><p>{message.content}</p></article>)}</div><div className="multi-role-composer"><textarea aria-label="多人角色追问" onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(); } }} placeholder="向当前角色提一个具体问题" rows={3} value={input} /><button className="button button-primary" disabled={!input.trim()} onClick={send} type="button">发送追问</button></div></section>
      </div>
    </div>
  );
}
