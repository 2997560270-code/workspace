import { expect, test, type Page } from "@playwright/test";
import { reachFeedback } from "./e2e-helpers";

// E2E 隔离模式下，服务端直接把该 cookie 的值当作登录用户（见 auth-server.ts）。
const OWNER = "e2e-owner-fb009";
const LEARNER = "e2e-learner-fb009";
const NOTE_CONTENT = "FB-009/FB-011 点评：这次判断缺少对真实使用者的确认，建议下次先还原失败环节再给结论。";

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
  await page.getByText("产品练习生", { exact: true }).waitFor({ state: "attached" });
}

test("manager views member training overview and leaves notes under own account (FB-009/FB-011)", async ({ page }) => {
  // 负责人创建团队并拿到邀请码
  await loginAs(page, OWNER);
  await page.getByRole("button", { name: /我的能力/ }).click();
  await page.getByTestId("team-workspace-panel").waitFor();
  await page.getByLabel("团队名称").fill("FB009 训练小组");
  await page.getByRole("button", { name: "创建团队" }).click();
  const inviteCode = (await page.getByTestId("team-invite-code").innerText()).trim();
  expect(inviteCode.length).toBeGreaterThanOrEqual(4);

  // 学习者加入团队：能看到完整成员列表，但没有管理视图
  await loginAs(page, LEARNER);
  await page.getByRole("button", { name: /我的能力/ }).click();
  await page.getByTestId("team-workspace-panel").waitFor();
  await page.getByLabel("团队邀请码").fill(inviteCode);
  await page.getByRole("button", { name: "加入团队" }).click();
  await expect(page.getByTestId("team-member-list").locator("[data-testid^='team-member-']")).toHaveCount(2);
  await expect(page.getByTestId(`team-member-${LEARNER}`)).toContainText("（你）");
  await expect(page.getByTestId("team-manager-view")).toHaveCount(0);

  // 学习者完成一次训练，产生一条训练记录
  await page.getByRole("button", { name: /今日训练/ }).click();
  await reachFeedback(page);

  // 负责人以自己账号查看成员概况并保存点评（FB-011）
  await loginAs(page, OWNER);
  await page.getByRole("button", { name: /我的能力/ }).click();
  const overview = page.getByTestId(`team-member-overview-${LEARNER}`);
  await expect(overview).toContainText("已完成 1 次训练");
  await page.getByTestId("team-mentor-member").selectOption(LEARNER);
  const sessionSelect = page.getByTestId("team-mentor-session");
  await expect(sessionSelect).toBeEnabled();
  await sessionSelect.selectOption({ index: 1 });
  await page.getByLabel("点评内容").fill(NOTE_CONTENT);
  await expect(page.getByTestId("team-mentor-hint")).toContainText("负责人");
  await page.getByTestId("team-mentor-save").click();
  await expect(page.getByTestId("team-mentor-status")).toContainText("点评已保存");
  await expect(page.getByTestId("team-notes")).toContainText(NOTE_CONTENT);

  // FB-013：点评记录可追溯到具体训练，并能直接跳转查看那条记录
  const firstNote = page.getByTestId("team-notes").locator("blockquote").first();
  await expect(firstNote).toContainText("针对训练：");
  await firstNote.getByRole("button", { name: "查看这条训练记录" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "复盘与复练" })).toBeVisible();
  await expect(page.locator(".review-list button.active")).toHaveCount(1);
  await expect(page.locator(".review-detail")).toBeVisible();

  // 学习者在自己账号的复盘中看到负责人留下的点评
  await loginAs(page, LEARNER);
  await page.getByRole("button", { name: /复盘与复练/ }).click();
  await expect(page.getByTestId("review-team-notes")).toContainText(NOTE_CONTENT);
});

// FB-012：点评前从「点评成员训练」直接跳到复盘视图查看这条训练记录。
test("manager jumps from mentor form to review view for the selected record (FB-012)", async ({ page }) => {
  const owner = "e2e-owner-fb012";
  const learner = "e2e-learner-fb012";

  await loginAs(page, owner);
  await page.getByRole("button", { name: /我的能力/ }).click();
  await page.getByTestId("team-workspace-panel").waitFor();
  await page.getByLabel("团队名称").fill("FB012 训练小组");
  await page.getByRole("button", { name: "创建团队" }).click();
  const inviteCode = (await page.getByTestId("team-invite-code").innerText()).trim();

  await loginAs(page, learner);
  await page.getByRole("button", { name: /我的能力/ }).click();
  await page.getByTestId("team-workspace-panel").waitFor();
  await page.getByLabel("团队邀请码").fill(inviteCode);
  await page.getByRole("button", { name: "加入团队" }).click();

  await page.getByRole("button", { name: /今日训练/ }).click();
  await reachFeedback(page);

  await loginAs(page, owner);
  await page.getByRole("button", { name: /我的能力/ }).click();
  await page.getByTestId("team-mentor-member").selectOption(learner);
  const sessionSelect = page.getByTestId("team-mentor-session");
  await expect(sessionSelect).toBeEnabled();
  await sessionSelect.selectOption({ index: 1 });
  await expect(page.getByTestId("team-mentor-view-record")).toBeEnabled();

  await page.getByTestId("team-mentor-view-record").click();

  // 直接跳到「复盘与复练」视图，并选中刚才选中的那条记录
  await expect(page.getByRole("heading", { level: 1, name: "复盘与复练" })).toBeVisible();
  await expect(page.locator(".review-list button.active")).toHaveCount(1);
  await expect(page.locator(".review-detail")).toBeVisible();
  await expect(page.getByText("还没有可以复盘的训练")).toHaveCount(0);

  // 返回「我的能力」后，点评表单仍保留刚才的成员与记录选择（FB-012）
  await page.getByRole("button", { name: /我的能力/ }).click();
  await expect(page.getByTestId("team-mentor-member")).toHaveValue(learner);
  const sessionValue = await sessionSelect.inputValue();
  expect(sessionValue.length).toBeGreaterThan(0);
  await expect(page.getByTestId("team-mentor-view-record")).toBeEnabled();
});
