import { expect, test, type Page } from "@playwright/test";

/**
 * RT-004：团队名称 / 邀请码输入在过短时给出可见的动态提示。
 * 本轮用自动化把这条「待回归」项客观验证掉，而不是等人工复核。
 */

const USER = "e2e-team-input-hints";

async function loginAs(page: Page) {
  await page.context().addCookies([{
    name: "product_drill_e2e_user",
    value: USER,
    domain: "127.0.0.1",
    path: "/",
    sameSite: "Lax",
  }]);
  await page.goto("/");
  await page.getByRole("heading", { level: 1, name: "今天，练会一个真正的产品判断" }).waitFor();
}

test("team name and invite code show length hints (RT-004)", async ({ page }) => {
  await loginAs(page);
  await page.getByRole("button", { name: /我的能力/ }).click();
  await page.getByTestId("team-workspace-panel").waitFor();

  // 团队名称少于 2 字 → 动态提示
  await page.getByLabel("团队名称").fill("1");
  await expect(page.getByTestId("team-name-hint")).toContainText("至少 2 个字");

  // 邀请码少于 4 位 → 动态提示
  await page.getByLabel("团队邀请码").fill("ab");
  await expect(page.getByTestId("team-invite-hint")).toContainText("至少 4 位");
});
