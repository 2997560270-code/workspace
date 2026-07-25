import { expect, test } from "@playwright/test";
import { enterApp } from "./e2e-helpers";

test("requires the demo login before the direction A dashboard", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "建立你的第一条能力证据" })).toBeVisible();
  await page.getByRole("button", { name: "开始首次诊断", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "今天，练会一个真正的产品判断" })).toBeVisible();
});

test("stores the demo session cookie", async ({ page }) => {
  await enterApp(page);
  const cookies = await page.context().cookies();
  expect(cookies.some((cookie) => cookie.name === "product_drill_user")).toBe(true);
});
