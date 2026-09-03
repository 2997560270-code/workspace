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
  await page.getByText(/产品练习生 · (服务端记录|本地缓存)/).waitFor({ state: "attached" });
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

  // 学习者在自己账号的复盘中看到负责人留下的点评
  await loginAs(page, LEARNER);
  await page.getByRole("button", { name: /复盘与复练/ }).click();
  await expect(page.getByTestId("review-team-notes")).toContainText(NOTE_CONTENT);
});
