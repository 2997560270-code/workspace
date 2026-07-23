import { defineConfig, devices } from "@playwright/test";

const useInstalledChrome = process.env.PLAYWRIGHT_BROWSER_CHANNEL !== "chromium";

export default defineConfig({
  testDir: "tests",
  testMatch: "**/*.spec.ts",
  globalSetup: "./tests/global-setup.ts",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "on-first-retry"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], ...(useInstalledChrome ? { channel: "chrome" as const } : {}) }
    }
  ]
});
