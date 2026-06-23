import { expect, test } from "@playwright/test";

test("opens a completed training history detail", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "进入工作台" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "训练工作台" })).toBeVisible();

  await page.getByRole("button", { name: "开始训练" }).click();
  await page.getByPlaceholder("输入你的回复，Enter 发送").fill("我会先确认真实用户和业务指标。");
  await page.getByRole("button", { name: "发送" }).click();
  await page.getByRole("button", { name: "提交方案" }).click();

  await page.getByRole("button", { name: "对话历史" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "对话历史" })).toBeVisible();
  await expect(page.locator(".history-record")).toHaveCount(1);

  await page.getByRole("button", { name: "查看详情" }).click();

  await expect(page.getByText("历史详情")).toBeVisible();
  await expect(page.getByText("训练已开始")).toBeVisible();
  await expect(page.getByText("综合评分")).toBeVisible();
});

test("keeps the current typed answer when submitting before sending", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "进入工作台" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "训练工作台" })).toBeVisible();

  await page.getByRole("button", { name: "开始训练" }).click();
  await page.getByPlaceholder("输入你的回复，Enter 发送").fill("这是我还没单独发送的方案回答。");
  await page.getByRole("button", { name: "提交方案" }).click();

  await page.getByRole("button", { name: "对话历史" }).click();
  await page.getByRole("button", { name: "查看详情" }).click();

  await expect(page.getByText("这是我还没单独发送的方案回答。")).toBeVisible();
});

test("opens history from the conversation record button", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "进入工作台" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "训练工作台" })).toBeVisible();

  await page.getByPlaceholder("输入你的回复，Enter 发送").fill("从对话记录按钮进入历史也要看到我。");
  await page.getByRole("button", { name: "发送" }).click();
  await page.getByRole("button", { name: "提交方案" }).click();
  await page.getByRole("button", { name: "查看对话记录" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "对话历史" })).toBeVisible();
  await page.getByRole("button", { name: "查看详情" }).click();
  await expect(page.getByText("从对话记录按钮进入历史也要看到我。")).toBeVisible();
});

test("switching scenario updates the active session and history record", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "进入工作台" }).click();

  await page.getByRole("button", { name: "开始训练" }).click();
  await page.getByLabel("行业场景").selectOption("B2B");
  await expect(page.getByText("行业场景已切换为 B2B，可以继续在当前对话框交流。")).toBeVisible();

  await page.getByPlaceholder("输入你的回复，Enter 发送").fill("切换场景后提交的方案应该归到 B2B。");
  await page.getByRole("button", { name: "提交方案" }).click();
  await page.getByRole("button", { name: "对话历史" }).click();

  await expect(page.locator(".history-record").first()).toContainText("B2B");
});
