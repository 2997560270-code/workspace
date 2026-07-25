"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { Sentry.captureException(error); }, [error]);
  return (
    <html lang="zh-CN">
      <body>
        <main className="error-page">
          <span className="section-kicker">Product Drill</span>
          <h1>训练页面暂时无法加载</h1>
          <p>你的输入不会被发送到分析系统。可以重试当前页面；如果问题持续出现，请稍后再试。</p>
          <button className="button button-primary" onClick={reset} type="button">重新加载</button>
        </main>
      </body>
    </html>
  );
}
