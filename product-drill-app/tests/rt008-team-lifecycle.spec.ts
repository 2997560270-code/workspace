import { expect, test, type Page } from "@playwright/test";

/**
 * RT-008 模拟测试：团队退出 / 移除 / 解散在真实界面上的表现。
 *
 * 本地试用模式下团队目录存在 localStorage，因此同一个浏览器里
 * 换账号（换 cookie）即可模拟「负责人」与「成员」两侧的操作。
 * 注意：负责人必须用固定的账号 id（enterApp 会分配随机 id，后续无法再登回来）。
 */

const OWNER = "e2e-rt008-owner";
const LEARNER = "e2e-rt008-learner";

async function loginAs(page: Page, userId: string) {
  await page.context().addCookies([{
    name: "product_drill_e2e_user",
    value: userId,
    domain: "127.0.0.1",
    path: "/",
    sameSite: "Lax",
  }]);
  await page.goto("/");
  await page.getByRole("heading", { level: 1, name: "今天，练会一个真正的产品判断" }).waitFor();
}

async function openTeamPanel(page: Page) {
  await page.getByRole("button", { name: /我的能力/ }).click();
  await page.getByTestId("team-workspace-panel").waitFor();
}

test("RT-008 成员可以退出团队，负责人可以移除成员并解散团队", async ({ page }) => {
  // 负责人建队并拿到邀请码
  await loginAs(page, OWNER);
  await openTeamPanel(page);
  await page.getByLabel("团队名称").fill("RT008 前端组");
  await page.getByRole("button", { name: "创建团队" }).click();
  const inviteCode = (await page.getByTestId("team-invite-code").innerText()).trim();
  expect(inviteCode.length).toBeGreaterThanOrEqual(4);

  // 负责人看到的是「解散团队」，不是「退出团队」
  await expect(page.getByTestId("team-dissolve")).toBeVisible();
  await expect(page.getByTestId("team-leave")).toHaveCount(0);
  await expect(page.getByTestId("team-member-list").locator("[data-testid^='team-member-']")).toHaveCount(1);

  // 学习者用邀请码加入
  await loginAs(page, LEARNER);
  await openTeamPanel(page);
  await page.getByLabel("团队邀请码").fill(inviteCode);
  await page.getByRole("button", { name: "加入团队" }).click();
  await expect(page.getByTestId("team-member-list").locator("[data-testid^='team-member-']")).toHaveCount(2);

  // 成员看到的是「退出团队」，且没有任何移除他人的按钮
  await expect(page.getByTestId("team-leave")).toBeVisible();
  await expect(page.getByTestId("team-dissolve")).toHaveCount(0);
  await expect(page.getByTestId(`team-member-remove-${OWNER}`)).toHaveCount(0);

  // 成员退出 → 回到建队/加入界面
  await page.getByTestId("team-leave").click();
  await expect(page.getByTestId("team-lifecycle-status")).toContainText("已退出团队");
  await expect(page.getByTestId("team-member-list")).toHaveCount(0);
  await expect(page.getByLabel("团队邀请码")).toBeVisible();

  // 负责人侧：成员已消失，只剩自己
  await loginAs(page, OWNER);
  await openTeamPanel(page);
  await expect(page.getByTestId("team-member-list").locator("[data-testid^='team-member-']")).toHaveCount(1);

  // 成员重新加入后，负责人可以移除该成员
  await loginAs(page, LEARNER);
  await openTeamPanel(page);
  await page.getByLabel("团队邀请码").fill(inviteCode);
  await page.getByRole("button", { name: "加入团队" }).click();
  await expect(page.getByTestId("team-member-list").locator("[data-testid^='team-member-']")).toHaveCount(2);

  await loginAs(page, OWNER);
  await openTeamPanel(page);
  await expect(page.getByTestId(`team-member-remove-${LEARNER}`)).toBeVisible();
  await page.getByTestId(`team-member-remove-${LEARNER}`).click();
  await expect(page.getByTestId("team-lifecycle-status")).toContainText("已移除该成员");
  await expect(page.getByTestId(`team-member-${LEARNER}`)).toHaveCount(0);
  await expect(page.getByTestId("team-member-list").locator("[data-testid^='team-member-']")).toHaveCount(1);

  // 移除后成员重新加入，负责人解散团队 → 全员脱离
  await loginAs(page, LEARNER);
  await openTeamPanel(page);
  await page.getByLabel("团队邀请码").fill(inviteCode);
  await page.getByRole("button", { name: "加入团队" }).click();
  await expect(page.getByTestId("team-member-list").locator("[data-testid^='team-member-']")).toHaveCount(2);

  await loginAs(page, OWNER);
  await openTeamPanel(page);
  await page.getByTestId("team-dissolve").click();
  await expect(page.getByTestId("team-lifecycle-status")).toContainText("团队已解散");
  await expect(page.getByTestId("team-member-list")).toHaveCount(0);

  // 成员侧也确认脱离了团队
  await loginAs(page, LEARNER);
  await openTeamPanel(page);
  await expect(page.getByTestId("team-member-list")).toHaveCount(0);
  await expect(page.getByLabel("团队邀请码")).toBeVisible();
});
