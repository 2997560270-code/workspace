import { expect, test } from "@playwright/test";
import { enterApp } from "./e2e-helpers";

test("runs an evidence-led interview and opens the judgment canvas", async ({ page }) => {
  await enterApp(page);
  await page.getByRole("button", { name: "开始 3 分钟诊断", exact: true }).click();
  await expect(page.getByText("最近好几个客户都在投诉报表导出太慢")).toBeVisible();
  const input = page.getByRole("textbox", { name: "你的追问", exact: true });
  await input.fill("谁每天使用报表，谁负责最终决策？");
  await page.getByRole("button", { name: "发送追问", exact: true }).click();
  await expect(page.locator(".message.ai").last()).toContainText("财务分析师");
  await expect(page.locator(".message.user p").last()).toHaveCSS("text-align", "left");
  await expect(page.getByText("20%", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "结束访谈，整理判断", exact: true }).click();
  await expect(page.getByRole("heading", { name: "把对话信息转成一个可以验证的判断" })).toBeVisible();
});

test("shows a voice input fallback without blocking text training", async ({ page }) => {
  await enterApp(page);
  await page.getByRole("button", { name: "开始 3 分钟诊断", exact: true }).click();
  await expect(page.getByRole("button", { name: "语音输入", exact: true })).toBeVisible();
  // FB-002：点击后失败/不支持必须有可见提示（不能只藏在 title 里）
  await page.getByRole("button", { name: "语音输入", exact: true }).click();
  await expect(page.getByTestId("voice-input-notice")).toContainText(/请直接输入文字|可重试或直接输入文字/);
  await page.getByRole("textbox", { name: "你的追问", exact: true }).fill("谁每天使用这个流程？");
  await expect(page.getByRole("button", { name: "发送追问", exact: true })).toBeEnabled();
});

test("shows the submitted question and thinking state before the AI reply arrives", async ({ page }) => {
  await enterApp(page);
  await page.getByRole("button", { name: "开始 3 分钟诊断", exact: true }).click();
  const input = page.getByRole("textbox", { name: "你的追问", exact: true });
  await expect(input).toBeEnabled();
  const messageList = page.getByTestId("message-list");
  await messageList.evaluate((element) => {
    element.style.height = "100px";
    element.style.maxHeight = "100px";
    element.style.minHeight = "0";
  });

  let releaseResponse!: () => void;
  const responseReleased = new Promise<void>((resolve) => {
    releaseResponse = resolve;
  });
  await page.route("**/api/training/sessions/*/messages", async (route) => {
    await responseReleased;
    const body = route.request().postDataJSON() as {
      content: string;
      session: { messages: Array<Record<string, unknown>>; [key: string]: unknown };
    };
    const turnIndex = body.session.messages.length;
    const session = {
      ...body.session,
      engine: "deterministic",
      modelVersion: "e2e-test",
      messages: [
        ...body.session.messages,
        { id: `e2e-user-${turnIndex}`, role: "user", content: body.content, turnIndex },
        { id: `e2e-ai-${turnIndex + 1}`, role: "ai", content: "测试回复", turnIndex: turnIndex + 1 }
      ]
    };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ session, fallback: true })
    });
  });

  const question = "谁每天使用报表，谁负责最终决策？";
  await input.fill(question);
  await page.getByRole("button", { name: "发送追问", exact: true }).click();

  await expect(page.getByTestId("pending-user-message")).toContainText(question);
  await expect(page.getByTestId("thinking-indicator")).toContainText("正在思考");
  await expect.poll(async () => messageList.evaluate((element) =>
    element.scrollTop + element.clientHeight >= element.scrollHeight - 2
  )).toBe(true);

  releaseResponse();
  await expect(page.getByTestId("thinking-indicator")).toHaveCount(0);
  await page.unroute("**/api/training/sessions/*/messages");
});

test("strict mode shows a countdown and disables hints", async ({ page }) => {
  await enterApp(page);
  await page.getByRole("button", { name: "开始 3 分钟诊断", exact: true }).click();
  await page.getByRole("button", { name: "严格", exact: true }).click();
  await expect(page.getByTestId("strict-timer")).toContainText("剩余");
  await expect(page.getByRole("button", { name: "给我一个轻提示", exact: true })).toBeDisabled();
  await expect(page.getByRole("textbox", { name: "你的追问", exact: true })).toBeEnabled();
});

test("mode switching never inflates the strict countdown (FB-005)", async ({ page }) => {
  await enterApp(page);
  await page.getByRole("button", { name: "开始 3 分钟诊断", exact: true }).click();
  const timer = page.getByTestId("strict-timer");
  const fullSeconds = 6 * 60; // 首次诊断场景固定 6 分钟

  function parseSeconds(text: string): number {
    const match = text.match(/(\d{2}):(\d{2})/);
    if (!match) throw new Error(`Unexpected timer text: ${text}`);
    return Number(match[1]) * 60 + Number(match[2]);
  }

  for (let index = 0; index < 3; index += 1) {
    await page.getByRole("button", { name: "严格", exact: true }).click();
    await expect(timer).toContainText("剩余");
    const remaining = parseSeconds(await timer.innerText());
    expect(remaining, `第 ${index + 1} 次切换到严格后计时被放大`).toBeLessThanOrEqual(fullSeconds);
    expect(remaining).toBeGreaterThanOrEqual(fullSeconds - 10);
    await page.getByRole("button", { name: "练习", exact: true }).click();
    // 练习模式下计时停摆，模拟用户停留一段时间后再切回严格。
    await page.waitForTimeout(1500);
  }
});

test("shows submission progress while judgment feedback is being generated", async ({ page }) => {
  await enterApp(page);
  await page.getByRole("button", { name: "开始 3 分钟诊断", exact: true }).click();
  const input = page.getByRole("textbox", { name: "你的追问", exact: true });
  await input.fill("谁每天使用报表，谁负责最终决策？");
  await page.getByRole("button", { name: "发送追问", exact: true }).click();
  await expect(page.locator(".message.ai").last()).toBeVisible();
  await page.getByRole("button", { name: "结束访谈，整理判断", exact: true }).click();
  await page.getByRole("textbox", { name: "核心问题", exact: true }).fill("还没有确认真实使用者和失败环节");
  await page.getByRole("textbox", { name: "建议行动", exact: true }).fill("先还原当前流程，再决定优化范围");

  let releaseEvaluation!: () => void;
  const evaluationReleased = new Promise<void>((resolve) => {
    releaseEvaluation = resolve;
  });
  await page.route("**/api/training/sessions/*/evaluation", async (route) => {
    await evaluationReleased;
    await route.continue();
  });

  await page.getByRole("button", { name: "提交判断并查看反馈", exact: true }).click();
  await expect(page.getByTestId("judgment-submit-status")).toContainText(/正在(保存你的判断|生成证据反馈)/);
  await expect(page.getByRole("button", { name: /正在(提交判断|生成反馈)/ })).toBeDisabled();

  releaseEvaluation();
  await expect(page.getByRole("heading", { name: "系统为什么做出这个判断" })).toBeVisible();
  await page.unroute("**/api/training/sessions/*/evaluation");
});
