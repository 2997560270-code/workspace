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
  await page.getByLabel("点评人").fill("产品主管");
  // FB-010：内容为空/过短时按钮置灰必须给出可见原因，不能静默禁用。
  await expect(page.getByTestId("mentor-note-hint")).toContainText("至少 4 个字");
  await expect(page.getByRole("button", { name: "保存点评", exact: true })).toBeDisabled();
  await page.getByLabel("点评内容").fill("好");
  await expect(page.getByTestId("mentor-note-hint")).toContainText("当前 1 字");
  await page.getByLabel("点评内容").fill("追问已经落到真实流程，下一次继续确认影响范围。");
  await expect(page.getByTestId("mentor-note-hint")).toContainText("可以保存了");
  await page.getByRole("button", { name: "保存点评", exact: true }).click();
  await expect(page.getByTestId("mentor-note")).toContainText("产品主管");
});

test("updates the training map status after completing a scenario (FB-003)", async ({ page }) => {
  await enterApp(page);
  await reachFeedback(page);
  await page.getByRole("button", { name: "完成并返回今日训练", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "复盘与复练" })).toBeVisible();

  await page.getByRole("button", { name: "02 训练地图 按能力选择训练任务", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "训练地图" })).toBeVisible();

  // 完成诊断的场景（首次诊断固定为 export-slow）必须不再是「未训练」
  const trainedStatus = page.getByTestId("scenario-status-export-slow");
  await expect(trainedStatus).toBeVisible();
  await expect(trainedStatus).not.toHaveText("未训练");
  await expect(page.getByTestId("scenario-card-export-slow"))
    .toContainText(/已训练 \d+ 次 · 最新证据分 \d+/);
  await expect(
    page.getByTestId("scenario-card-export-slow")
      .getByRole("button", { name: "复练这个场景" })
  ).toBeVisible();

  // 未参与的场景保持「未训练」，整体进度同步更新
  await expect(page.getByTestId("scenario-status-dashboard-request")).toHaveText("未训练");
  await expect(page.getByTestId("map-progress")).toContainText("已覆盖 1 / 12");
});

test("compares repeated attempts of the same scenario", async ({ page }) => {
  await enterApp(page);
  await reachFeedback(page);
  await page.getByRole("button", { name: "完成并返回今日训练", exact: true }).click();
  await page.getByRole("button", { name: "用同一场景重新训练", exact: true }).click();

  await page.getByRole("textbox", { name: "你的追问", exact: true }).fill("谁每天使用报表，谁负责最终决策？");
  await page.getByRole("button", { name: "发送追问", exact: true }).click();
  await page.getByRole("button", { name: "结束访谈，整理判断", exact: true }).click();
  await page.getByRole("textbox", { name: "核心问题", exact: true }).fill("真实使用者和失败环节还没有确认");
  await page.getByRole("textbox", { name: "建议行动", exact: true }).fill("先还原当前流程，再决定优化范围");
  await page.getByRole("button", { name: "提交判断并查看反馈", exact: true }).click();
  await page.getByRole("heading", { name: "系统为什么做出这个判断" }).waitFor();
  await page.getByRole("button", { name: "完成并返回今日训练", exact: true }).click();

  await expect(page.getByTestId("scenario-comparison")).toContainText("同场景对比");
  await expect(page.getByTestId("scenario-comparison")).toContainText("改善维度");
});
