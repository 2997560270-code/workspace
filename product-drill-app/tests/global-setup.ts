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
  const child = spawn(process.execPath, ["scripts/start-test-server.cjs"], {
    cwd: process.cwd(),
    env: { ...process.env, ALLOW_DEMO_AUTH: "true", PORT: "3100" },
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
