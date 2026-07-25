import { expect, test } from "@playwright/test";
import { enterApp, reachFeedback } from "./e2e-helpers";

test("shows ability evidence after a completed training", async ({ page }) => {
  await enterApp(page);
  await reachFeedback(page);
  await page.getByRole("button", { name: "完成并返回今日训练", exact: true }).click();
  await page.getByRole("button", { name: "04 我的能力 查看掌握状态和证据", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "我的能力" })).toBeVisible();
  await expect(page.getByText("1 条训练记录", { exact: false })).toBeVisible();
  await expect(page.locator(".ability-table article")).toHaveCount(5);
});
