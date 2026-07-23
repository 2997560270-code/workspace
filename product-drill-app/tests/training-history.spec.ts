import { expect, test } from "@playwright/test";
import { enterApp, reachFeedback } from "./e2e-helpers";

test("records a successful local retry in review", async ({ page }) => {
  await enterApp(page);
  await reachFeedback(page);
  await page.getByRole("button", { name: "开始 2 分钟复练", exact: true }).click();
  await page.getByRole("textbox", { name: "只提出一个更好的问题", exact: true }).fill("你们目前的完整流程是怎么完成的？");
  await page.getByRole("button", { name: "提交复练", exact: true }).click();
  await expect(page.getByText("已观察到改善", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "完成并返回今日训练", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "复盘与复练" })).toBeVisible();
  await expect(page.locator(".status-tag", { hasText: "已改善" })).toBeVisible();
});
