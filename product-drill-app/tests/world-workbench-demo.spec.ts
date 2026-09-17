import { expect, test } from "@playwright/test";
import { enterApp, reachFeedback } from "./e2e-helpers";

const WORLD_TITLES = [
  "高权威需求方要求立即增加 AI 摘要",
  "大客户续约压力下的 SSO 请求",
  "增长指标下降后的竞品功能跟进",
];

// FB-013：进入决策阶段前必须确认至少一条世界事实（evidence_eligible）。
// 每个世界按维度给出能命中揭示条件触发词的问题；世界 3 需三个维度都有证据，
// 复盘才会出现「三个维度」，世界 1 则故意不查替代方案、让「已有替代方案」进入缺失清单。
const WORLD_PROBES: Array<{ workflow: string; consequence: string; alternative?: string }> = [
  {
    workflow: "现有摘要的使用情况怎么样？使用率是多少？",
    consequence: "如果不解决入口路径问题，会有什么影响？",
  },
  {
    workflow: "现在哪些核心用户在用？活跃用户的使用数据如何？",
    consequence: "如果客户不续签，会有什么影响？",
  },
  {
    workflow: "竞品功能的实际使用数据和用户群分布如何？",
    consequence: "如果跟进竞品，工程量和技术成本有多大？会影响路线图吗？",
    alternative: "有没有做过流失访谈？用户为什么流失？",
  },
];

async function completeCurrentWorld(page: import("@playwright/test").Page, worldIndex: number) {
  const probes = WORLD_PROBES[worldIndex];
  const input = page.getByPlaceholder("提出调查问题或采取行动，Enter 发送，Shift+Enter 换行");
  await page.getByRole("button", { name: "当前流程", exact: true }).click();
  await input.fill(probes.workflow);
  await page.getByRole("button", { name: "发送", exact: true }).click();
  await page.getByRole("button", { name: "问题影响", exact: true }).click();
  await input.fill(probes.consequence);
  await page.getByRole("button", { name: "发送", exact: true }).click();
  if (probes.alternative) {
    await page.getByRole("button", { name: "替代方案", exact: true }).click();
    await input.fill(probes.alternative);
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

  await page.getByTestId("open-world-workbench").click();
  await expect(
    page.getByRole("heading", { level: 2, name: "高权威需求方要求立即增加 AI 摘要" })
  ).toBeVisible();
  await expect(page.getByText("独立进行", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "提示（标记辅助证据）", exact: true }).click();
  await expect(page.getByText("提示辅助", { exact: true })).toBeVisible();

  const messages = page.locator(".wb-message-world");
  const initialMessageCount = await messages.count();
  await page
    .getByPlaceholder("提出调查问题或采取行动，Enter 发送，Shift+Enter 换行")
    .fill("CEO 希望这个 AI 摘要可以达到怎样的效果？");
  await page.getByRole("button", { name: "发送", exact: true }).click();

  await expect(messages).toHaveCount(initialMessageCount + 1);
  await expect(messages.filter({ hasText: "[确定性演示模式]" })).toHaveCount(0);
  await page
    .getByPlaceholder("提出调查问题或采取行动，Enter 发送，Shift+Enter 换行")
    .fill("我想了解这个摘要要展示多少信息，我才能知道要做到什么程度");
  await page.getByRole("button", { name: "发送", exact: true }).click();

  await expect(messages).toHaveCount(initialMessageCount + 2);
  await expect(messages.filter({ hasText: "你可以继续调查" })).toHaveCount(0);
  await expect(messages.filter({ hasText: "没有直接关系" })).toHaveCount(0);
  await expect(page.getByRole("alert")).not.toContainText("离线演示模式：动作已记录，叙述由本地规则生成。");
});

test("short learner messages keep a content-sized bubble", async ({ page }) => {
  await enterApp(page);
  await page.getByTestId("open-world-workbench").click();

  await page
    .getByPlaceholder("提出调查问题或采取行动，Enter 发送，Shift+Enter 换行")
    .fill("1");
  await page.getByRole("button", { name: "发送", exact: true }).click();

  await expect(page.locator(".wb-notice-banner")).toBeVisible();

  const userMessage = page.locator(".wb-message-user");
  await expect(userMessage).toHaveCount(1);
  const dimensions = await userMessage.evaluate((element) => ({
    bubbleWidth: element.getBoundingClientRect().width,
    contentWidth: element.querySelector("p")?.getBoundingClientRect().width ?? 0,
    timelineWidth: element.parentElement?.getBoundingClientRect().width ?? 0,
    textAlign: window.getComputedStyle(element.querySelector("p")!).textAlign,
  }));

  expect(dimensions.bubbleWidth).toBeLessThan(dimensions.timelineWidth);
  expect(dimensions.bubbleWidth).toBeLessThan(200);
  expect(Math.abs(dimensions.bubbleWidth - dimensions.contentWidth)).toBeLessThan(1);
  expect(dimensions.textAlign).toBe("left");

  await page.getByRole("button", { name: "完成调查，提交决策", exact: true }).click();
  await expect(page.locator(".wb-error-banner")).toContainText("你还没有获得任何有效调查证据");
});

test("desktop completes world 1 to 2 to 3 and opens the judgment profile", async ({ page }) => {
  await enterApp(page);
  await page.getByTestId("open-world-workbench").click();

  for (let index = 0; index < WORLD_TITLES.length; index += 1) {
    await expect(page.getByRole("heading", { level: 2, name: WORLD_TITLES[index] })).toBeVisible();
    await completeCurrentWorld(page, index);
    if (index === 0) {
      await expect(page.locator(".wb-reflect")).toContainText("已有替代方案");
    }
    if (index === 2) {
      await expect(page.locator(".wb-reflect")).toContainText("三个维度");
    }
    const finishButton = page.locator(".wb-reflect .button-primary");
    await expect(finishButton).toHaveCount(1);
    await finishButton.click();
  }

  await expect(page.getByRole("heading", { level: 1, name: "我的能力" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 3, name: "premature_solution_commitment" })).toBeVisible();
  await expect(page.getByText("评分版本 0.3.0", { exact: true })).toBeVisible();
  await expect(page.getByText("尚无证据，完成情境对话后自动更新。", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /查看证据/ })).toHaveCount(0);

  await page.getByRole("button", { name: /复盘与复练/ }).click();
  await expect(page.getByRole("heading", { level: 2, name: "世界决策记录" })).toBeVisible();
  for (const title of WORLD_TITLES) {
    await expect(page.getByText(title, { exact: true })).toBeVisible();
  }

  await page.getByRole("button", { name: new RegExp(WORLD_TITLES[0]) }).first().click();
  const timeline = page.getByLabel("决策与后果时间线");
  await expect(timeline).toBeVisible();
  await expect(timeline.getByText("情境", { exact: true })).toBeVisible();
  await expect(timeline.getByText("评分版本", { exact: true })).toBeVisible();
  await expect(timeline.getByText("模型", { exact: true })).toBeVisible();
  await expect(timeline.getByText("提交决策", { exact: true })).toBeVisible();
  await expect(timeline.getByText("后果已揭示", { exact: true })).toBeVisible();
});

test("shows the three-world progression track and allows switching worlds (FB-007)", async ({ page }) => {
  await enterApp(page);
  await page.getByTestId("open-world-workbench").click();

  // 三个世界的概念说明与进度必须可见
  const track = page.getByTestId("wb-world-track");
  await expect(track).toBeVisible();
  await expect(track).toContainText("世界 1、2、3 依次验证同一个底层判断习惯");
  await expect(track.getByText("世界 1", { exact: true })).toBeVisible();
  await expect(track.getByText("世界 2", { exact: true })).toBeVisible();
  await expect(track.getByText("世界 3", { exact: true })).toBeVisible();

  // 当前为世界 1：进行中；其余未开始；点击世界 2 可切换并展示对应标题
  await expect(track.getByText("进行中")).toHaveCount(1);
  await expect(track.getByText("未开始")).toHaveCount(2);
  await track.getByRole("button", { name: /世界 2/ }).click();
  await expect(page.getByRole("heading", { level: 2, name: WORLD_TITLES[1] })).toBeVisible();
  await expect(page.getByTestId("wb-world-track").getByText("进行中")).toHaveCount(1);
});

test("rejects meaningless decision input instead of revealing positive consequences (FB-013)", async ({ page }) => {
  await enterApp(page);
  await page.getByTestId("open-world-workbench").click();
  const input = page.getByPlaceholder("提出调查问题或采取行动，Enter 发送，Shift+Enter 换行");
  // 先取得一条有效调查证据，才能进入决策阶段（FB-013 的闸门）。
  await input.fill("现有摘要的使用情况怎么样？使用率是多少？");
  await page.getByRole("button", { name: "发送", exact: true }).click();
  await page.getByRole("button", { name: "完成调查，提交决策", exact: true }).click();

  // 乱码输入必须被拦截，且给出可见原因，而不是放行到后果揭示。
  await page.getByLabel("你的判断（问题是什么）").fill("hhhh");
  await expect(page.locator(".wb-field-error").first()).toContainText("有效内容");
  await page.getByLabel("你的行动方案").fill("hhhh");
  await page.getByLabel("预期结果").fill("hhhh");
  await expect(page.getByTestId("wb-decision-invalid")).toBeVisible();
  await expect(page.getByRole("button", { name: "提交决策（不可撤回）", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "揭示后果", exact: true })).toHaveCount(0);
});

test("review panel can reopen the submitted conversation and judgment canvas (FB-006)", async ({ page }) => {
  await enterApp(page);
  await reachFeedback(page);

  await page.getByRole("button", { name: /复盘与复练/ }).click();
  const submission = page.getByTestId("review-submission");
  await expect(submission).toBeVisible();
  await submission.locator("summary").click();
  // 判断画布与对话原文必须能回看，而不是只留一个分数。
  await expect(submission).toContainText("真实使用者和失败环节还没有确认");
  await expect(submission).toContainText("提交的对话");
  await expect(submission).toContainText("谁每天使用报表，谁负责最终决策？");
});

test("locally completed worlds appear in the decision history as local demo records (FB-006)", async ({ page }) => {
  await enterApp(page);

  // 模拟离线演示模式下本地完成的世界（服务端无对应记录）。
  await page.evaluate(() => {
    const prefix = "product-drill-world-progress-v1:";
    const key = Object.keys(window.localStorage).find((item) => item.startsWith(prefix));
    if (key) window.localStorage.setItem(key, JSON.stringify(["world-1-ai-summary"]));
  });
  await page.reload();
  await page.getByRole("heading", { level: 1, name: "今天，练会一个真正的产品判断" }).waitFor();

  await page.getByRole("button", { name: /复盘与复练/ }).click();
  await expect(page.getByRole("heading", { level: 2, name: "世界决策记录" })).toBeVisible();
  await expect(page.getByText("高权威需求方要求立即增加 AI 摘要", { exact: true })).toBeVisible();
  await expect(page.getByTestId("world-history-local")).toContainText("本地演示记录");

  // 本地记录点开时说明未同步服务端，而不是静默请求失败。
  await page.getByRole("button", { name: /高权威需求方要求立即增加 AI 摘要/ }).click();
  await expect(page.getByTestId("world-history-local-note")).toBeVisible();
});

test("mobile viewport can complete the governed three-world loop", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enterApp(page);
  await page.getByTestId("open-world-workbench").click();

  for (let index = 0; index < WORLD_TITLES.length; index += 1) {
    await expect(page.locator(".wb-header h2")).toHaveCount(1);
    await completeCurrentWorld(page, index);
    const finishButton = page.locator(".wb-reflect .button-primary");
    await expect(finishButton).toHaveCount(1);
    await finishButton.click();
    if (await page.getByRole("heading", { level: 1, name: "我的能力" }).isVisible().catch(() => false)) {
      break;
    }
  }

  await expect(page.getByRole("heading", { level: 1, name: "我的能力" })).toBeVisible();
});
