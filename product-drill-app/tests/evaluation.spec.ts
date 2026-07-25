import { expect, test } from "@playwright/test";
import { enterApp, reachFeedback } from "./e2e-helpers";

test("shows evidence dimensions and a concrete retry task", async ({ page }) => {
  await enterApp(page);
  await reachFeedback(page);
  await expect(page.getByText("逐句证据反馈", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "用户与角色识别" })).toBeVisible();
  await expect(page.getByText("谁每天使用报表，谁负责最终决策？", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "开始 2 分钟复练", exact: true })).toBeVisible();
});
