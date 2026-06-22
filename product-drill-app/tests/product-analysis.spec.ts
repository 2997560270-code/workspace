import { expect, test } from "@playwright/test";

test("analyzes a user's own product profile", async ({ page }) => {
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
  await expect(page.getByText("门店库存管理工具")).toBeVisible();
  await expect(page.locator(".product-question")).toHaveCount(5);
  await expect(page.locator(".product-suggestion")).toHaveCount(3);
});
