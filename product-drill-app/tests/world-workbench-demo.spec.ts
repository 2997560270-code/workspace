import { expect, test } from "@playwright/test";
import { enterApp } from "./e2e-helpers";

const WORLD_TITLES = [
  "高权威需求方要求立即增加 AI 摘要",
  "大客户续约压力下的 SSO 请求",
  "增长指标下降后的竞品功能跟进",
];

async function completeCurrentWorld(page: import("@playwright/test").Page, action: string) {
  const input = page.getByPlaceholder("提出调查问题或采取行动，Enter 发送，Shift+Enter 换行");
  await page.getByRole("button", { name: "当前流程", exact: true }).click();
  await input.fill(`${action}（当前流程）`);
  await page.getByRole("button", { name: "发送", exact: true }).click();
  await page.getByRole("button", { name: "问题影响", exact: true }).click();
  await input.fill(`${action}（问题影响）`);
  await page.getByRole("button", { name: "发送", exact: true }).click();
  // World 3 is the only transfer test; cover all dimensions there so the
  // production transfer judge can persist an independent transfer record.
  const worldHeading = page.getByRole("heading", { level: 2, name: WORLD_TITLES[2] });
  if (await worldHeading.isVisible().catch(() => false)) {
    await page.getByRole("button", { name: "替代方案", exact: true }).click();
    await input.fill(`${action}（替代方案）`);
    await page.getByRole("button", { name: "发送", exact: true }).click();
  }
  await page.getByRole("button", { name: "完成调查，提交决策", exact: true }).click();
  await page.getByLabel("你的判断（问题是什么）").fill("先核查真实问题和当前数据，再决定是否承诺功能");
  await page.getByLabel("你的行动方案").fill("完成一轮有边界的诊断并给出分层行动方案");
  await page.getByLabel("预期结果").fill("团队依据真实证据处理根因，并减少错误投入");
  await page.getByRole("button", { name: "提交决策（不可撤回）", exact: true }).click();
  await page.getByRole("button", { name: "揭示后果", exact: true }).click();
  await page.getByRole("button", { name: "查看证据反馈", exact: true }).click();
}

test("demo world workbench records an action without falling back to the browser-only mode", async ({ page }) => {
  await enterApp(page);

  await page.getByRole("button", { name: "进入世界工作台" }).click();
  await expect(
    page.getByRole("heading", { level: 2, name: "高权威需求方要求立即增加 AI 摘要" })
  ).toBeVisible();

  const messages = page.locator(".wb-message-world");
  const initialMessageCount = await messages.count();
  await page
    .getByPlaceholder("提出调查问题或采取行动，Enter 发送，Shift+Enter 换行")
    .fill("现有摘要功能的使用率是多少？");
  await page.getByRole("button", { name: "发送", exact: true }).click();

  await expect(messages).toHaveCount(initialMessageCount + 1);
  await expect(messages.filter({ hasText: "[确定性演示模式]" })).toHaveCount(1);
  await expect(messages.filter({ hasText: "12%" })).toHaveCount(1);
  await expect(page.getByRole("alert")).not.toContainText("离线演示模式：动作已记录，叙述由本地规则生成。");
});

test("desktop completes world 1 to 2 to 3 and opens the judgment profile", async ({ page }) => {
  await enterApp(page);
  await page.getByRole("button", { name: "进入世界工作台" }).click();

  for (let index = 0; index < WORLD_TITLES.length; index += 1) {
    await expect(page.getByRole("heading", { level: 2, name: WORLD_TITLES[index] })).toBeVisible();
    await completeCurrentWorld(page, "请核查当前使用数据、真实问题和现有替代方案");
    const finishButton = page.locator(".wb-reflect .button-primary");
    await expect(finishButton).toHaveCount(1);
    await finishButton.click();
  }

  await expect(page.getByRole("heading", { level: 1, name: "我的能力" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 3, name: "premature_solution_commitment" })).toBeVisible();
  await expect(page.getByText("Rubric 0.3.0", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /查看证据/ })).toBeVisible();

  await page.locator(".jp-expand-btn").click();
  await page.locator(".ev-open-decision").first().click();
  const profileTimeline = page.locator(".decision-timeline");
  await expect(profileTimeline).toBeFocused();
  await expect
    .poll(async () => profileTimeline.evaluate((element) => element.getBoundingClientRect().top >= 0))
    .toBe(true);
  await page.locator(".ev-open-decision").first().click();
  await expect(profileTimeline).toBeFocused();
  await expect
    .poll(async () => profileTimeline.evaluate((element) => element.getBoundingClientRect().top >= 0))
    .toBe(true);
  await page.locator(".decision-timeline-close").click();

  await page.getByRole("button", { name: /复盘与复练/ }).click();
  await expect(page.getByRole("heading", { level: 2, name: "世界决策记录" })).toBeVisible();
  for (const title of WORLD_TITLES) {
    await expect(page.getByText(title, { exact: true })).toBeVisible();
  }

  await page.getByRole("button", { name: new RegExp(WORLD_TITLES[0]) }).click();
  const timeline = page.getByLabel("决策与后果时间线");
  await expect(timeline).toBeVisible();
  await expect(timeline.getByText("World", { exact: true })).toBeVisible();
  await expect(timeline.getByText("Rubric", { exact: true })).toBeVisible();
  await expect(timeline.getByText("Model", { exact: true })).toBeVisible();
  await expect(timeline.getByText("提交决策", { exact: true })).toBeVisible();
  await expect(timeline.getByText("后果已揭示", { exact: true })).toBeVisible();
});

test("mobile viewport can complete the governed three-world loop", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enterApp(page);
  await page.getByRole("button", { name: "进入世界工作台" }).click();

  for (let index = 0; index < WORLD_TITLES.length; index += 1) {
    await expect(page.locator(".wb-header h2")).toHaveCount(1);
    await completeCurrentWorld(page, "请先调查真实问题、当前流程和替代方案");
    const finishButton = page.locator(".wb-reflect .button-primary");
    await expect(finishButton).toHaveCount(1);
    await finishButton.click();
    if (await page.getByRole("heading", { level: 1, name: "我的能力" }).isVisible().catch(() => false)) {
      break;
    }
  }

  await expect(page.getByRole("heading", { level: 1, name: "我的能力" })).toBeVisible();
});
