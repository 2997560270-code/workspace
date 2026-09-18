import type { Page } from "@playwright/test";

/** 用户可见文案的单一事实来源：文案改造时只改这里。
 *  注意：这里只收敛「定位用」的文案；验证用户看到什么的断言仍应写在各 spec 里。 */
export const UI_LABELS = {
  todayHeading: "今天，练会一个真正的产品判断",
  sidebarRole: "产品练习生",
} as const;

export type ViewId = "today" | "map" | "review" | "ability";

/** 设计令牌在 e2e 的单一事实来源：批次4 改字体/颜色时只改这里。 */
export const FONTS = {
  display: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", system-ui, -apple-system, "Segoe UI", sans-serif',
  body: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", system-ui, -apple-system, "Segoe UI", sans-serif',
  mono: '"IBM Plex Mono", "JetBrains Mono", "Cascadia Code", "SF Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
} as const;

export const INK = {
  claim: "rgb(21, 26, 34)",
  evidence: "rgb(65, 74, 88)",
  provenance: "rgb(123, 130, 144)",
  onDarkClaim: "rgb(245, 242, 234)",
  onDarkProvenance: "rgb(141, 150, 166)",
  sage: "rgb(31, 111, 84)",
  coral: "rgb(176, 67, 47)",
} as const;

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
  await page.getByText(UI_LABELS.sidebarRole, { exact: true }).waitFor({ state: "attached" });
}

export async function reachFeedback(page: Page) {
  await page.getByTestId("start-today-training").click();
  const input = page.getByTestId("reply-input");
  await input.fill("谁每天使用报表，谁负责最终决策？");
  await page.getByTestId("send-reply").click();
  await page.getByTestId("finish-interview").click();
  await page.getByTestId("judgment-field-coreProblem").fill("真实使用者和失败环节还没有确认");
  await page.getByTestId("judgment-field-recommendation").fill("暂不直接重写功能，先还原当前流程并验证影响");
  await page.getByTestId("judgment-submit").click();
  await page.getByRole("heading", { name: "系统为什么做出这个判断" }).waitFor();
}
