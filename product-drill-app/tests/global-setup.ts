import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import type { FullConfig } from "@playwright/test";

const SERVER_URL = "http://127.0.0.1:3100";

async function waitForServer(child: ChildProcess) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Product Drill test server exited with code ${child.exitCode}`);
    try {
      const response = await fetch(SERVER_URL, { redirect: "manual" });
      if (response.status >= 200 && response.status < 500) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Timed out waiting for Product Drill test server");
}

export default async function globalSetup(_config: FullConfig) {
  // 开发调试：已经有一个以 E2E_ISOLATED_USERS=true 启动的本地服务器时，
  // 可以用 E2E_SKIP_SERVER=true + E2E_BASE_URL 直接复用它跑用例。
  if (process.env.E2E_SKIP_SERVER === "true") {
    return async () => {};
  }
  const useLiveModel = process.env.E2E_USE_LIVE_MODEL === "true";
  const modelEnv = useLiveModel
    ? {}
    : {
        OPENAI_API_KEY: "",
        OPENAI_BASE_URL: "",
        OPENAI_ROLEPLAY_MODEL: "",
        OPENAI_EVALUATION_MODEL: "",
        OPENAI_MODEL_VERSION: "deterministic-e2e",
      };
  const child = spawn(process.execPath, ["scripts/start-test-server.cjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...modelEnv,
      ALLOW_DEMO_AUTH: "true",
      E2E_ISOLATED_USERS: "true",
      PORT: "3100",
    },
    stdio: "inherit",
    windowsHide: true
  });
  await waitForServer(child);

  return async () => {
    if (!child.pid || child.exitCode !== null) return;
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
    } else {
      child.kill("SIGTERM");
    }
  };
}
