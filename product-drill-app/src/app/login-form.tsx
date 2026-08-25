"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { translateAuthError } from "../lib/auth";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";

type Mode = "login" | "register";
type Status = { kind: "info" | "success" | "error"; text: string } | null;

export function LoginForm() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);

  async function recordSignIn(userId: string) {
    if (!supabase) return;
    try {
      // Persist login metadata to public.profiles; never block authentication.
      await supabase
        .from("profiles")
        .update({ last_sign_in_at: new Date().toISOString() })
        .eq("id", userId);
    } catch {
      /* best-effort */
    }
  }

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !email.trim() || !password) return;
    setBusy(true);
    setStatus({ kind: "info", text: "正在登录…" });
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    });
    if (error) {
      setBusy(false);
      setStatus({ kind: "error", text: translateAuthError(error.message) });
      return;
    }
    if (data.user) await recordSignIn(data.user.id);
    setBusy(false);
    setStatus({ kind: "success", text: "登录成功，正在进入…" });
    router.refresh();
  }

  async function handleRegister(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !email.trim() || !password) return;
    if (password.length < 8) {
      setStatus({ kind: "error", text: "密码至少需要 8 位。" });
      return;
    }
    if (password !== confirm) {
      setStatus({ kind: "error", text: "两次输入的密码不一致。" });
      return;
    }
    setBusy(true);
    setStatus({ kind: "info", text: "正在创建账号…" });
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { display_name: name.trim() || email.trim().split("@")[0] },
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    });
    if (error) {
      setBusy(false);
      setStatus({ kind: "error", text: translateAuthError(error.message) });
      return;
    }
    setBusy(false);
    if (data.session) {
      // Email confirmation is disabled: the user is already signed in.
      if (data.user) await recordSignIn(data.user.id);
      setStatus({ kind: "success", text: "注册成功，正在进入…" });
      router.refresh();
    } else {
      setStatus({ kind: "success", text: "注册成功！请查收验证邮件，完成验证后即可登录。" });
    }
  }

  async function handleMagicLink(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !email.trim()) return;
    setBusy(true);
    setStatus({ kind: "info", text: "正在发送登录链接…" });
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` }
    });
    setBusy(false);
    setStatus(
      error
        ? { kind: "error", text: translateAuthError(error.message) }
        : { kind: "success", text: "登录链接已发送，请检查邮箱。" }
    );
  }

  function switchMode(next: Mode) {
    setMode(next);
    setStatus(null);
  }

  const emailInvalid = !email.trim();
  const passwordInvalid = !password || (mode === "register" && password.length < 8);
  const submitDisabled = busy || emailInvalid || passwordInvalid || (mode === "register" && confirm !== password);

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
      {supabase ? (
        <section className="login-entry">
          <div className="login-panel">
            <div className="mark">PD</div>
            <span className="section-kicker">Product discovery gym</span>
            <h2>{mode === "login" ? "登录你的账号" : "创建你的账号"}</h2>
            <p>{mode === "login" ? "使用邮箱和密码登录，继续你的产品判断训练。" : "使用邮箱注册，建立属于你的能力证据档案。"}</p>

            <div className="login-tabs" role="tablist" aria-label="登录或注册">
              <button type="button" role="tab" aria-selected={mode === "login"} className={mode === "login" ? "active" : ""} onClick={() => switchMode("login")}>登录</button>
              <button type="button" role="tab" aria-selected={mode === "register"} className={mode === "register" ? "active" : ""} onClick={() => switchMode("register")}>注册</button>
            </div>

            <form className="login-form" onSubmit={mode === "login" ? handleLogin : handleRegister}>
              {mode === "register" ? (
                <label><span>昵称（可选）</span>
                  <input autoComplete="name" onChange={(event) => setName(event.target.value)} placeholder="例如：张明" type="text" value={name} />
                </label>
              ) : null}
              <label><span>邮箱</span>
                <input autoComplete="email" onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" type="email" value={email} required />
              </label>
              <label><span>密码</span>
                <input autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "register" ? 8 : undefined} onChange={(event) => setPassword(event.target.value)} placeholder={mode === "register" ? "至少 8 位" : "输入密码"} type="password" value={password} required />
              </label>
              {mode === "register" ? (
                <label><span>确认密码</span>
                  <input autoComplete="new-password" minLength={8} onChange={(event) => setConfirm(event.target.value)} placeholder="再次输入密码" type="password" value={confirm} required />
                </label>
              ) : null}
              <button className="button button-primary" disabled={submitDisabled} type="submit">
                {busy ? "请稍候…" : mode === "login" ? "登录" : "注册"}
              </button>
              {status ? (
                <p aria-live="polite" className={`login-status login-status--${status.kind}`}>{status.text}</p>
              ) : null}
            </form>

            {mode === "login" ? (
              <button className="login-switch" disabled={busy} type="button" onClick={handleMagicLink}>
                或使用无密码登录链接（邮箱）
              </button>
            ) : null}
            <button className="login-switch" type="button" onClick={() => switchMode(mode === "login" ? "register" : "login")}>
              {mode === "login" ? "还没有账号？注册一个" : "已有账号？去登录"}
            </button>

            <div className="login-note">使用 Supabase 安全存储账号与登录信息。</div>
          </div>
        </section>
      ) : (
        <section className="login-entry">
          <div className="login-panel">
            <div className="mark">PD</div>
            <span className="section-kicker">Product discovery gym</span>
            <h2>建立你的第一条能力证据</h2>
            <p>无需准备。进入后完成一个短场景，系统会从你的真实回答中识别最值得训练的行为。</p>
            <form action="/api/auth/demo" method="post">
              <button className="button button-primary" type="submit">开始首次诊断 <span aria-hidden="true">↗</span></button>
            </form>
            <div className="login-note">未配置 Supabase，当前仅启用本地开发演示账号。</div>
          </div>
        </section>
      )}
    </main>
  );
}
