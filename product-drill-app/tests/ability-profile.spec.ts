import { expect, test } from "@playwright/test";

test("shows ability profile from completed trainings", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "进入工作台" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "训练工作台" })).toBeVisible();

  const input = page.getByPlaceholder("输入你的回复，Enter 发送");
  await input.fill("先确认真实用户。");
  await page.getByRole("button", { name: "发送" }).click();
  await page.getByRole("button", { name: "提交方案" }).click();

  await page.getByRole("button", { name: "开始训练" }).click();
  for (const answer of ["确认预算。", "确认指标。", "确认落地周期。"]) {
    await input.fill(answer);
    await page.getByRole("button", { name: "发送" }).click();
  }
  await page.getByRole("button", { name: "提交方案" }).click();

  await page.getByRole("button", { name: "能力画像" }).click();

  await expect(page.getByText("完成训练")).toBeVisible();
  await expect(page.locator(".metrics").getByText("2 次", { exact: true })).toBeVisible();
  await expect(page.getByText("最近训练表现趋势")).toBeVisible();
  await expect(page.locator(".trend-point")).toHaveCount(2);
  await expect(page.getByText("能力维度表现")).toBeVisible();
  await expect(page.locator(".ability-dimension")).toHaveCount(7);
  await expect(page.getByRole("heading", { name: "高频短板" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "下一步推荐训练" })).toBeVisible();
});
