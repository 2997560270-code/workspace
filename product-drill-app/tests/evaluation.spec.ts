import { expect, test } from "@playwright/test";
import { enterApp, reachFeedback } from "./e2e-helpers";

test("shows evidence dimensions and a concrete retry task", async ({ page }) => {
  await enterApp(page);
  await reachFeedback(page);
  await expect(page.getByRole("heading", { name: "系统为什么做出这个判断" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "用户与角色识别" })).toBeVisible();
  await expect(page.getByText("谁每天使用报表，谁负责最终决策？", { exact: false })).toBeVisible();
  await expect(page.getByTestId("start-retry-feedback")).toBeVisible();
});
