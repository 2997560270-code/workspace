import { expect, test } from "@playwright/test";

test("completes the MVP acceptance flow", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "进入工作台" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "训练工作台" })).toBeVisible();

  await page.getByRole("button", { name: "我的产品" }).click();
  await page.getByLabel("产品名称").fill("门店库存管理工具");
  await page.getByLabel("产品介绍").fill("帮助中小餐饮门店记录库存、提醒补货、减少损耗。");
  await page.getByLabel("目标用户").fill("中小餐饮门店老板和店长");
  await page.getByLabel("核心功能").fill("库存记录、低库存提醒、损耗统计");
  await page.getByLabel("当前阶段").fill("MVP");
  await page.getByLabel("产品链接").fill("https://example.com");
  await page.getByRole("button", { name: "生成产品理解" }).click();
  await expect(page.getByText("产品理解摘要")).toBeVisible();

  await page.getByRole("button", { name: "场景库" }).click();
  await page.getByRole("button", { name: "用 B2B 开始训练" }).click();
  await page.getByRole("button", { name: "开始训练" }).click();
  await page.getByPlaceholder("输入你的回复，Enter 发送").fill("先确认采购角色、预算周期和验证指标。");
  await page.getByRole("button", { name: "发送" }).click();
  await page.getByRole("button", { name: "提交方案" }).click();
  await expect(page.getByText("综合评分")).toBeVisible();

  await page.getByRole("button", { name: "对话历史" }).click();
  await expect(page.getByText("历史详情")).toBeVisible();
  await expect(page.getByText("先确认采购角色、预算周期和验证指标。")).toBeVisible();

  await page.getByRole("button", { name: "能力画像" }).click();
  await expect(page.getByText("最近训练表现趋势")).toBeVisible();
  await expect(page.getByRole("heading", { name: "下一步推荐训练" })).toBeVisible();
});
