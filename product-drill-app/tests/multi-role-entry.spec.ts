import { expect, test } from "@playwright/test";
import { enterApp } from "./e2e-helpers";

// FB-008：多角色训练入口必须在训练地图显眼可见且可用（需求文档 4.5，主入口为训练地图）。
test("multi-role training entry is reachable from the training map (FB-008)", async ({ page }) => {
  await enterApp(page);
  await page.getByRole("button", { name: "02 训练地图 按能力选择训练任务", exact: true }).click();

  // 入口卡片紧跟场景列表，位于第一屏（在自定义场景/课程入口之前）
  const entry = page.getByTestId("multi-role-entry");
  await expect(entry).toBeVisible();
  const entryTop = await entry.evaluate((el) => el.getBoundingClientRect().top);
  const customTop = await page.getByTestId("custom-scenario-entry").evaluate((el) => el.getBoundingClientRect().top);
  const courseTop = await page.getByTestId("course-entry").evaluate((el) => el.getBoundingClientRect().top);
  expect(entryTop).toBeLessThan(customTop);
  expect(entryTop).toBeLessThan(courseTop);

  await entry.getByRole("button", { name: "开始多人角色训练", exact: true }).click();
  await expect(page.getByText("多人角色训练", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("每个角色的会话会独立保存")).toBeVisible();
});
