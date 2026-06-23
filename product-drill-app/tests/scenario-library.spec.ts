import { expect, test } from "@playwright/test";

test("starts training from each scenario card", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "进入工作台" }).click();

  for (const scenario of ["B2B", "AI+", "企业员工培训"]) {
    await page.getByRole("button", { name: "场景库" }).click();
    await expect(page.getByRole("heading", { name: scenario })).toBeVisible();
    await page.getByRole("button", { name: `用 ${scenario} 开始训练` }).click();

    await expect(page.getByRole("heading", { level: 1, name: "训练工作台" })).toBeVisible();
    await expect(page.getByLabel("行业场景")).toHaveValue(scenario);
    await page.getByRole("button", { name: "开始训练" }).click();
    await expect(page.getByText(`当前场景是 ${scenario}`)).toBeVisible();
  }
});
