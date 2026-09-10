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

test("shows why the register button is disabled (FB-001)", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "注册" }).click();

  const register = page.getByRole("button", { name: "注册", exact: true });
  const hint = page.getByTestId("login-submit-hint");

  // 空表单：按钮置灰，但必须给出可见原因
  await expect(register).toBeDisabled();
  await expect(hint).toContainText("请输入邮箱地址");

  // 填了邮箱但密码为空：提示跟着更新，而不是继续置灰没下文
  await page.getByLabel("邮箱").fill("a@example.com");
  await expect(register).toBeDisabled();
  await expect(hint).toContainText("请输入密码");

  // 补足密码后提示消失、按钮可点
  await page.getByLabel(/^密码/).fill("12345678");
  await page.getByLabel("确认密码").fill("12345678");
  await expect(register).toBeEnabled();
  await expect(hint).toHaveCount(0);
});
