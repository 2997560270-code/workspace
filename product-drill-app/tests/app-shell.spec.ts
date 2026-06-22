import { expect, test } from "@playwright/test";

test("navigates between the five MVP modules", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "进入工作台" }).click();
  await page.waitForLoadState("networkidle");

  await expect(page.getByRole("heading", { level: 1, name: "训练工作台" })).toBeVisible();

  await page.getByRole("button", { name: "我的产品" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "我的产品" })).toBeVisible();

  await page.getByRole("button", { name: "对话历史" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "对话历史" })).toBeVisible();

  await page.getByRole("button", { name: "能力画像" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "能力画像" })).toBeVisible();

  await page.getByRole("button", { name: "场景库" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "场景库" })).toBeVisible();
});
