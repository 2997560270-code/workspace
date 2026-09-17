import type { Page } from "@playwright/test";

/** 用户可见文案的单一事实来源：文案改造时只改这里。
 *  注意：这里只收敛「定位用」的文案；验证用户看到什么的断言仍应写在各 spec 里。 */
export const UI_LABELS = {
  todayHeading: "今天，练会一个真正的产品判断",
  sourcePattern: /产品练习生 · (服务端记录|本地缓存)/,
} as const;

export type ViewId = "today" | "map" | "review" | "ability";

/** 侧栏导航走 data-testid，不依赖拼接可访问名。 */
export async function gotoView(page: Page, view: ViewId) {
  await page.getByTestId(`nav-${view}`).click();
}

export async function enterApp(page: Page) {
  await page.context().addCookies([{
    name: "product_drill_e2e_user",
    value: `e2e-${crypto.randomUUID()}`,
    domain: "127.0.0.1",
    path: "/",
    sameSite: "Lax",
  }]);
  // In E2E-isolated mode the isolated demo cookie is the login path, so the
  // app enters the dashboard even when Supabase is configured (no real account).
  await page.goto("/");
  await page.getByRole("heading", { level: 1, name: UI_LABELS.todayHeading }).waitFor();
  await page.getByText(UI_LABELS.sourcePattern).waitFor({ state: "attached" });
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
