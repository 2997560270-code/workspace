import { expect, test } from "@playwright/test";

test("renders the MVP training configuration without a duplicate usage-scene field", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "进入工作台" }).click();
  await page.waitForLoadState("networkidle");

  const scenario = page.getByLabel("行业场景");
  await expect(scenario).toHaveValue("AI+");
  await expect(scenario.locator("option")).toHaveText(["B2B", "AI+", "企业员工培训"]);

  await expect(page.getByRole("button", { name: "用户需求提出" })).toBeVisible();
  await expect(page.getByRole("button", { name: "客户咨询" })).toBeVisible();
  await expect(page.getByText("用户需求提出：AI 先提出业务需求")).toBeVisible();
  await expect(page.getByText("使用场景")).toHaveCount(0);
});

test("selects training mode and difficulty before starting", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "进入工作台" }).click();

  await page.getByRole("button", { name: "客户咨询" }).click();
  await page.getByRole("button", { name: "严格" }).click();

  await expect(page.getByRole("button", { name: "客户咨询" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "严格" })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "开始训练" }).click();
  await expect(page.getByText("模式是 客户咨询")).toBeVisible();
  await expect(page.getByText("难度是 严格")).toBeVisible();
});
