import { expect, test } from "@playwright/test";

test("requires login before showing the workbench", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: "登录 Product Drill" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "训练工作台" })).toHaveCount(0);

  await page.getByRole("button", { name: "进入工作台" }).click();
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { level: 1, name: "训练工作台" })).toBeVisible();
});
