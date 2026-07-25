import { expect, test } from "@playwright/test";
import { enterApp } from "./e2e-helpers";

test("starts a task from the training map", async ({ page }) => {
  await enterApp(page);
  await page.getByRole("button", { name: "02 训练地图 按能力选择训练任务", exact: true }).click();
  const card = page.locator(".scenario-card", { hasText: "数据大屏需求" });
  await card.getByRole("button", { name: "开始训练" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "数据大屏需求" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "连锁零售运营负责人" })).toBeVisible();
});
