import { expect, test } from "@playwright/test";

test("starts a training session and completes three message rounds", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "进入工作台" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "训练工作台" })).toBeVisible();
  await expect(page.locator(".bubble")).toHaveCount(0);

  await page.getByRole("button", { name: "开始训练" }).click();
  await expect(page.getByText("训练已开始")).toBeVisible();
  await expect(page.getByText("您的具体业务是什么")).toBeVisible();

  const input = page.getByPlaceholder("输入你的回复，Enter 发送");
  for (const answer of [
    "我的业务是AI+服务。",
    "我会追问业务目标和现有流程。",
    "我会用数据验证方案价值。"
  ]) {
    await input.fill(answer);
    await page.getByRole("button", { name: "发送" }).click();
  }

  await expect(page.locator(".bubble.user")).toHaveCount(3);
  await expect(page.locator(".bubble.ai")).toHaveCount(4);
  await expect(page.getByText("围绕 AI+ 方向")).toBeVisible();
  await expect(page.getByText("第 3 轮继续追问")).toBeVisible();
});

test("sends the typed answer with Enter", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "进入工作台" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "训练工作台" })).toBeVisible();

  await page.getByRole("button", { name: "开始训练" }).click();
  const input = page.getByPlaceholder("输入你的回复，Enter 发送");
  await input.fill("这是按回车发送的用户输入。");
  await input.press("Enter");

  await expect(page.locator(".bubble.user", { hasText: "这是按回车发送的用户输入。" })).toHaveCount(1);
  await expect(input).toHaveValue("");
});

test("does not output conversation before training starts", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "进入工作台" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "训练工作台" })).toBeVisible();

  const input = page.getByPlaceholder("输入你的回复，Enter 发送");
  await input.fill("我还没有点击开始训练。");

  await expect(page.getByRole("button", { name: "发送" })).toBeDisabled();
  await expect(page.locator(".bubble")).toHaveCount(0);
});

test("sizes user bubbles to the answer content", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "进入工作台" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "训练工作台" })).toBeVisible();

  await page.getByRole("button", { name: "开始训练" }).click();
  const input = page.getByPlaceholder("输入你的回复，Enter 发送");
  await input.fill("短句");
  await page.getByRole("button", { name: "发送" }).click();

  const shortBubble = page.locator(".bubble.user", { hasText: "短句" });
  await expect(shortBubble).toHaveCount(1);

  const longAnswer = "LONG_USER_INPUT_SHOULD_WRAP_INSIDE_THE_BUBBLE_".repeat(12);
  await input.fill(longAnswer);
  await page.getByRole("button", { name: "发送" }).click();

  const sizes = await page.locator(".bubble.user").evaluateAll((bubbles) =>
    bubbles.map((bubble) => ({
      width: bubble.getBoundingClientRect().width,
      height: bubble.getBoundingClientRect().height,
      scrollWidth: bubble.scrollWidth,
      clientWidth: bubble.clientWidth
    }))
  );

  expect(sizes[0].width).toBeLessThan(120);
  expect(sizes[1].width).toBeGreaterThan(sizes[0].width);
  expect(sizes[1].height).toBeGreaterThan(sizes[0].height);
  expect(sizes[1].scrollWidth).toBeLessThanOrEqual(sizes[1].clientWidth + 1);
});

test("asks for the concrete business again after switching scenario", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "进入工作台" }).click();

  await page.getByRole("button", { name: "开始训练" }).click();
  const input = page.getByPlaceholder("输入你的回复，Enter 发送");

  await input.fill("我的业务是AI客服。");
  await page.getByRole("button", { name: "发送" }).click();
  await input.fill("主要服务企业售后团队。");
  await page.getByRole("button", { name: "发送" }).click();

  await page.getByLabel("行业场景").selectOption("B2B");

  await expect(page.locator(".bubble.ai").last()).toContainText("当前行业场景已经切换到B2B");
  await expect(page.locator(".bubble.ai").last()).toContainText("您的具体业务是什么");

  await input.fill("我的业务是B2B采购系统。");
  await page.getByRole("button", { name: "发送" }).click();

  await expect(page.locator(".bubble.ai").last()).toContainText("围绕 B2B 方向");
  await expect(page.locator(".bubble.ai").last()).toContainText("B2B采购系统");
  await expect(page.locator(".bubble.ai").last()).not.toContainText("第 3 轮继续追问");
  await expect(page.locator(".bubble.ai").last()).not.toContainText("第 4 轮继续追问");
});
