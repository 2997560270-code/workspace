import { expect, test } from "@playwright/test";
import { enterApp } from "./e2e-helpers";

test("requires the login page before the direction A dashboard", async ({ page }) => {
  await page.goto("/");
  // Supabase email/password login is the entry gate.
  await expect(page.getByRole("heading", { name: "登录你的账号" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "登录" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "注册" })).toBeVisible();
  // Not signed in: the dashboard must stay locked behind login.
  await expect(page.getByRole("heading", { level: 1, name: "今天，练会一个真正的产品判断" })).not.toBeVisible();
});

test("enters the app with the isolated e2e session cookie", async ({ page }) => {
  await enterApp(page);
  const cookies = await page.context().cookies();
  expect(cookies.some((cookie) => cookie.name === "product_drill_e2e_user")).toBe(true);
});
