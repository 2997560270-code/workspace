import { expect, test } from "@playwright/test";
import { enterApp } from "./e2e-helpers";

test("renders six focused scenarios in the training map", async ({ page }) => {
  await enterApp(page);
  await page.getByRole("button", { name: "02 训练地图 按能力选择训练任务", exact: true }).click();
  await expect(page.locator(".scenario-card")).toHaveCount(6);
  await expect(page.getByText("数据大屏需求", { exact: true })).toBeVisible();
  await expect(page.getByText("老板要求加 AI", { exact: true })).toBeVisible();
});
