import { expect, test } from "@playwright/test";
import { enterApp } from "./e2e-helpers";

test("renders twelve focused scenarios in the training map", async ({ page }) => {
  await enterApp(page);
  await page.getByRole("button", { name: "02 训练地图 按能力选择训练任务", exact: true }).click();
  await expect(page.locator(".scenario-card")).toHaveCount(12);
  await expect(page.getByText("数据大屏需求", { exact: true })).toBeVisible();
  await expect(page.getByText("老板要求加 AI", { exact: true })).toBeVisible();
});

test("generates a bounded product material experiment draft", async ({ page }) => {
  await enterApp(page);
  await page.getByRole("button", { name: "02 训练地图 按能力选择训练任务", exact: true }).click();
  await page.getByRole("button", { name: "开始资料生成实验", exact: true }).click();
  await page.getByRole("heading", { name: "把产品判断整理成一页可讨论的资料" }).waitFor();
  await page.getByLabel("产品名称").fill("库存助手");
  await page.getByLabel("目标用户").fill("门店店长");
  await page.getByLabel("核心问题").fill("临期商品经常漏处理");
  await page.getByLabel("已有证据").fill("三家门店访谈");
  await page.getByRole("button", { name: "生成实验草稿", exact: true }).click();
  await expect(page.getByTestId("product-material-draft")).toContainText("非正式资料");
  await expect(page.getByTestId("product-material-draft")).toContainText("不能替代真实用户");
});

test("creates and runs a local custom scenario", async ({ page }) => {
  await enterApp(page);
  await page.getByRole("button", { name: "02 训练地图 按能力选择训练任务", exact: true }).click();
  await page.getByRole("button", { name: "创建本地场景", exact: true }).click();
  await page.getByLabel("场景标题").fill("仓库盘点异常");
  await page.getByLabel("行业或业务类型").fill("物流 SaaS");
  await page.getByLabel("对话角色").fill("仓储运营负责人");
  await page.getByLabel("场景背景").fill("月底盘点时发现库存差异。");
  await page.getByLabel("开场白").fill("我们需要一个库存差异提醒功能。");
  for (const skill of ["用户与角色识别", "场景与当前流程", "问题影响与根因", "现有替代方案", "成功指标"]) {
    await page.getByLabel(`隐藏事实：${skill}`).fill(`${skill} 的可验证事实。`);
  }
  await page.getByRole("button", { name: "保存并开始训练", exact: true }).click();
  await expect(page.locator("h2", { hasText: "仓库盘点异常" })).toBeVisible();
  await expect(page.getByText("本地自定义场景")).toBeVisible();
});

test("opens a course and records a lesson as complete", async ({ page }) => {
  await enterApp(page);
  await page.getByRole("button", { name: "02 训练地图 按能力选择训练任务", exact: true }).click();
  await page.getByRole("button", { name: "查看课程", exact: true }).click();
  await expect(page.getByRole("heading", { name: "把训练行为带回真实工作" })).toBeVisible();
  await page.getByRole("button", { name: "标记完成", exact: true }).first().click();
  await expect(page.getByRole("button", { name: "已完成", exact: true }).first()).toBeVisible();
});

test("switches between roles in a multi-role practice", async ({ page }) => {
  await enterApp(page);
  await page.getByRole("button", { name: "02 训练地图 按能力选择训练任务", exact: true }).click();
  await page.getByRole("button", { name: "开始多人角色训练", exact: true }).click();
  await expect(page.getByRole("heading", { name: "库存差异：同一问题的三种视角" })).toBeVisible();
  await page.getByRole("button", { name: /财务负责人/ }).click();
  await page.getByLabel("多人角色追问").fill("现在的流程是什么？");
  await page.getByRole("button", { name: "发送追问", exact: true }).click();
  await expect(page.getByTestId("multi-role-conversation")).toContainText("财务在结账前抽查");
});

test("searches the knowledge base and exposes community moderation", async ({ page }) => {
  await enterApp(page);
  await page.getByRole("button", { name: "02 训练地图 按能力选择训练任务", exact: true }).click();
  await page.getByRole("button", { name: "打开资源中心", exact: true }).click();
  await page.getByRole("tab", { name: "行业知识库", exact: true }).click();
  await page.getByLabel("搜索知识库").fill("AI");
  await expect(page.getByTestId("knowledge-list")).toContainText("AI 功能需求判断");
  await page.getByRole("tab", { name: "内容管理", exact: true }).click();
  await expect(page.getByTestId("resource-admin")).toContainText("本地管理员预览");
});

test("shows explicit subscription plans without starting payment", async ({ page }) => {
  await enterApp(page);
  await page.getByRole("button", { name: "02 训练地图 按能力选择训练任务", exact: true }).click();
  await page.getByRole("button", { name: "打开资源中心", exact: true }).click();
  await page.getByRole("tab", { name: "计划与订阅", exact: true }).click();
  await expect(page.getByTestId("billing-panel")).toContainText("本地计费预览");
  await expect(page.getByTestId("billing-panel")).toContainText("正式支付需要接入支付服务");
});

test("creates an invitation-only validation cohort", async ({ page }) => {
  await enterApp(page);
  await page.getByRole("button", { name: "02 训练地图 按能力选择训练任务", exact: true }).click();
  await page.getByRole("button", { name: "打开资源中心", exact: true }).click();
  await page.getByRole("tab", { name: "验证实验室", exact: true }).click();
  await page.getByLabel("验证批次名称").fill("封闭试验 01");
  await page.getByRole("button", { name: "创建邀请制批次", exact: true }).click();
  await expect(page.getByTestId("validation-lab")).toContainText("封闭试验 01");
  await expect(page.getByTestId("validation-invite-code")).toHaveText(/^[A-Z0-9]{10}$/);
});
