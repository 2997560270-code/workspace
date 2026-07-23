import { expect, test } from "@playwright/test";
import { enterApp } from "./e2e-helpers";

test("runs an evidence-led interview and opens the judgment canvas", async ({ page }) => {
  await enterApp(page);
  await page.getByRole("button", { name: "开始 3 分钟诊断", exact: true }).click();
  await expect(page.getByText("最近好几个客户都在投诉报表导出太慢")).toBeVisible();
  const input = page.getByRole("textbox", { name: "你的追问", exact: true });
  await input.fill("谁每天使用报表，谁负责最终决策？");
  await page.getByRole("button", { name: "发送追问", exact: true }).click();
  await expect(page.getByText("真正等待报表的是财务分析师", { exact: false })).toBeVisible();
  await expect(page.getByText("20%", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "结束访谈，整理判断", exact: true }).click();
  await expect(page.getByRole("heading", { name: "把对话信息转成一个可以验证的判断" })).toBeVisible();
});
