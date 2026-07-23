"use client";

import { useState, type FormEvent } from "react";
import { DEV_USER, SESSION_COOKIE } from "../lib/auth";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const supabase = createSupabaseBrowserClient();

  function demoLogin() {
    document.cookie = `${SESSION_COOKIE}=${DEV_USER.id}; path=/; SameSite=Lax`;
    window.location.href = "/";
  }

  async function sendMagicLink(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !email.trim()) return;
    setStatus("正在发送登录链接…");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` }
    });
    setStatus(error ? `发送失败：${error.message}` : "登录链接已发送，请检查邮箱。 ");
  }

  return (
    <main className="login-page">
      <section className="login-story">
        <div>
          <div className="brand">
            <div className="mark">PD</div>
            <div><strong>Product Drill</strong><span>AI 产品发现训练场</span></div>
          </div>
          <h1>练习真正的产品判断，而不是背诵标准答案。</h1>
          <p>AI 扮演真实业务角色。你负责追问、判断和提交方案，再用逐句证据反馈重练具体短板。</p>
        </div>
        <div className="login-proof">
          <div><strong>3 分钟</strong><span>完成首次能力诊断</span></div>
          <div><strong>1 个</strong><span>每轮只训练一个主要能力</span></div>
          <div><strong>可复练</strong><span>证明自己真的已经改善</span></div>
        </div>
      </section>
      <section className="login-entry">
        <div className="login-panel">
          <div className="mark">PD</div>
          <span className="section-kicker">Product discovery gym</span>
          <h2>建立你的第一条能力证据</h2>
          <p>无需准备。进入后完成一个短场景，系统会从你的真实回答中识别最值得训练的行为。</p>
          {supabase ? (
            <form className="login-form" onSubmit={sendMagicLink}>
              <label><span>邮箱</span><input autoComplete="email" onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" type="email" value={email} /></label>
              <button className="button button-primary" disabled={!email.trim()} type="submit">发送登录链接 <span aria-hidden="true">↗</span></button>
              {status ? <p aria-live="polite" className="login-status">{status}</p> : null}
            </form>
          ) : (
            <button className="button button-primary" onClick={demoLogin} type="button">开始首次诊断 <span aria-hidden="true">↗</span></button>
          )}
          <div className="login-note">{supabase ? "使用 Supabase 安全登录。" : "未配置 Supabase，当前仅启用本地开发演示账号。"}</div>
        </div>
      </section>
    </main>
  );
}
