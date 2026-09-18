import { expect, test } from "@playwright/test";
import { enterApp } from "./e2e-helpers";

test("settings center groups account, interface and model sections", async ({ page }) => {
  await enterApp(page);
  await page.getByTestId("open-settings").click();

  for (const name of ["账号", "界面", "模型"]) {
    await expect(page.getByRole("heading", { level: 2, name, exact: true })).toBeVisible();
  }
  await expect(page.getByText("数据存储", { exact: true })).toBeVisible();
  await expect(page.getByTestId("llm-current-model").or(page.getByText("不配置也能用", { exact: false }))).toBeVisible();
});

test("reduce motion switch applies immediately and persists", async ({ page }) => {
  await enterApp(page);
  await page.getByTestId("open-settings").click();

  const toggle = page.getByTestId("reduce-motion-switch");
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await expect(page.locator("html")).toHaveAttribute("data-reduce-motion", "on");
  await expect(page.getByText("已保存", { exact: true })).toBeVisible();

  await toggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-reduce-motion", "off");
});
