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
  await expect(page.getByText("20%", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "结束访谈，整理判断", exact: true }).click();
  await expect(page.getByRole("heading", { name: "把对话信息转成一个可以验证的判断" })).toBeVisible();
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
