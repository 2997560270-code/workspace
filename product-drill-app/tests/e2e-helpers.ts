import type { Page } from "@playwright/test";

export async function enterApp(page: Page) {
  await page.goto("/");
  const loginButton = page.getByRole("button", { name: "开始首次诊断", exact: true });
  if (await loginButton.isVisible().catch(() => false)) {
    await loginButton.click();
  }
  await page.getByRole("heading", { level: 1, name: "今天，练会一个真正的产品判断" }).waitFor();
  await page.getByText(/产品练习生 · (服务端记录|本地缓存)/).waitFor();
}

export async function reachFeedback(page: Page) {
  await page.getByRole("button", { name: "开始 3 分钟诊断", exact: true }).click();
  const input = page.getByRole("textbox", { name: "你的追问", exact: true });
  await input.fill("谁每天使用报表，谁负责最终决策？");
  await page.getByRole("button", { name: "发送追问", exact: true }).click();
  await page.getByRole("button", { name: "结束访谈，整理判断", exact: true }).click();
  await page.getByRole("textbox", { name: "核心问题", exact: true }).fill("真实使用者和失败环节还没有确认");
  await page.getByRole("textbox", { name: "建议行动", exact: true }).fill("暂不直接重写功能，先还原当前流程并验证影响");
  await page.getByRole("button", { name: "提交判断并查看反馈", exact: true }).click();
  await page.getByRole("heading", { name: "系统为什么做出这个判断" }).waitFor();
}
