import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 本地开发与 E2E 常用 127.0.0.1 访问，避免被 Next 开发服务器的跨源拦截。
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  // 演示界面全中文；Next 开发指示器点击后是英文框架调试面板，无法本地化，直接关闭。
  devIndicators: false
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  webpack: { treeshake: { removeDebugLogging: true } }
});
