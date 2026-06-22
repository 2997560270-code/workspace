"use client";

import { DEV_USER, SESSION_COOKIE } from "../lib/auth";

export function LoginForm() {
  function login() {
    // ponytail: local demo cookie; replace with Auth.js before real users.
    document.cookie = `${SESSION_COOKIE}=${DEV_USER.id}; path=/; SameSite=Lax`;
    window.location.href = "/";
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="mark">PD</div>
        <h1>登录 Product Drill</h1>
        <p>当前为 MVP 开发版，先使用演示账号进入工作台。</p>
        <button className="primary" onClick={login} type="button">进入工作台</button>
      </section>
    </main>
  );
}
