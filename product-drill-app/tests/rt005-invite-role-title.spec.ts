import { expect, test, type Page } from "@playwright/test";

/**
 * RT-005 模拟测试：邀请时指定身份 + 负责人自定义成员称谓。
 *
 * 覆盖反馈人的原始诉求：「应该是创建者可以选择其他人的身份（由创建者提供称谓）」。
 * 同时验证展示名不会改变权限角色（成员卡同时展示「称谓 · 角色」）。
 */

const OWNER = "e2e-rt005-owner";
const LEARNER = "e2e-rt005-learner";

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

test("RT-005 负责人可指定邀请身份并自定义成员称谓", async ({ page }) => {
  // 负责人建队时选择「导师」作为被邀请者身份
  await loginAs(page, OWNER);
  await openTeamPanel(page);
  await page.getByLabel("团队名称").fill("RT005 前端组");
  await page.getByTestId("team-create-invite-role").selectOption("coach");
  await page.getByRole("button", { name: "创建团队" }).click();

  const inviteCode = (await page.getByTestId("team-invite-code").innerText()).trim();
  expect(inviteCode.length).toBeGreaterThanOrEqual(4);
  await expect(page.getByTestId("team-invite-role")).toHaveValue("coach");

  // 成员按邀请码加入 → 直接是导师，而不是默认学习者
  await loginAs(page, LEARNER);
  await openTeamPanel(page);
  await page.getByLabel("团队邀请码").fill(inviteCode);
  await page.getByRole("button", { name: "加入团队" }).click();
  await expect(page.getByTestId(`team-member-${LEARNER}`)).toContainText("导师");
  // 普通成员看不到称谓编辑入口
  await expect(page.getByTestId(`team-member-title-${OWNER}`)).toHaveCount(0);

  // 负责人给该成员设置自定义称谓
  await loginAs(page, OWNER);
  await openTeamPanel(page);
  const titleInput = page.getByTestId(`team-member-title-${LEARNER}`);
  await expect(titleInput).toBeVisible();
  await titleInput.fill("产品总监");
  await titleInput.blur();

  // 展示为「称谓 · 角色」：展示名变了，权限角色仍是导师
  await expect(page.getByTestId("team-lifecycle-status")).toContainText("已保存成员称谓");
  await expect(page.getByTestId(`team-member-${LEARNER}`)).toContainText("产品总监 · 导师");

  // 重新加载后称谓仍然保留（随团队目录持久化）
  await page.reload();
  await openTeamPanel(page);
  await expect(page.getByTestId(`team-member-${LEARNER}`)).toContainText("产品总监 · 导师");

  // 清空称谓后回退到角色名
  const cleared = page.getByTestId(`team-member-title-${LEARNER}`);
  await cleared.fill("");
  await cleared.blur();
  await expect(page.getByTestId(`team-member-${LEARNER}`)).not.toContainText("产品总监");
  await expect(page.getByTestId(`team-member-${LEARNER}`)).toContainText("导师");
});
