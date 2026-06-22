import { expect, test } from "@playwright/test";

test("submits a solution and shows a structured evaluation", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "进入工作台" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "训练工作台" })).toBeVisible();

  await page.getByRole("button", { name: "开始训练" }).click();
  await expect(page.getByText("训练已开始")).toBeVisible();
  await page.getByPlaceholder("输入你的回复，Enter 发送").fill("方案是先定位目标用户，再验证业务指标。");
  await page.getByRole("button", { name: "发送" }).click();
  await page.getByRole("button", { name: "提交方案" }).click();

  await expect(page.getByText("综合评分")).toBeVisible();
  await expect(page.getByText("需求理解")).toBeVisible();
  await expect(page.getByText("表达与沟通")).toBeVisible();
  await expect(page.locator(".issue-item")).toHaveCount(3);
});
