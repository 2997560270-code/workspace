import { expect, test } from "@playwright/test";

test("formal app shell opens with the Demo V3 home structure", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByTestId("app-shell")).toBeVisible();
  await expect(page.getByTestId("side-nav")).toBeVisible();
  await expect(page.getByRole("heading", { name: "首页" })).toBeVisible();
  await expect(page.getByText("用 AI 训练完整产品思维")).toBeVisible();
  await expect(page.getByTestId("home-product-intro")).toContainText("Product Drill");
  await expect(page.getByTestId("home-core-functions")).toContainText("AI 客户模拟");
  await expect(page.getByTestId("home-metrics")).toContainText("24");
});

test("side navigation switches between the main MVP pages", async ({ page }) => {
  await page.goto("/");

  await page.getByTestId("nav-training").click();
  await expect(page.getByRole("heading", { name: "训练", exact: true })).toBeVisible();
  await expect(page.getByTestId("training-settings")).toContainText("训练设置");
  await expect(page.getByTestId("training-chat")).toContainText("请选择您的训练设置。");
  await expect(page.getByRole("button", { name: "确定" })).toBeVisible();

  await page.getByTestId("nav-products").click();
  await expect(page.getByRole("heading", { name: "产品", exact: true })).toBeVisible();
  await expect(page.getByTestId("product-archive")).toContainText("产品档案");
  await expect(page.getByTestId("product-reading")).toContainText("AI 产品解读");
  await expect(page.getByTestId("product-maturity")).toContainText("成熟度评估");

  await page.getByTestId("nav-history").click();
  await expect(page.getByRole("heading", { name: "历史", exact: true })).toBeVisible();
  await expect(page.getByTestId("history-inline-summary")).toContainText("24");
  await expect(page.getByTestId("history-inline-summary")).toContainText("6");
  await expect(page.getByTestId("history-inline-summary")).toContainText("+6.4");

  await page.getByTestId("nav-ability").click();
  await expect(page.getByRole("heading", { name: "能力", exact: true })).toBeVisible();
  await expect(page.getByTestId("ability-page")).toContainText("最近训练表现趋势");
  await expect(page.getByTestId("ability-page")).toContainText("能力维度表现");
  await expect(page.getByTestId("ability-page")).toContainText("高频短板");
  await expect(page.getByTestId("ability-page")).toContainText("下一步推荐训练");
});

test("training settings keeps the confirm button visible inside the settings panel", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("nav-training").click();

  const settings = page.getByTestId("training-settings");
  const confirm = page.getByTestId("training-confirm");
  await expect(confirm).toBeVisible();
  await expect(confirm).toHaveText("确定");

  const confirmBox = await confirm.boundingBox();
  expect(confirmBox).not.toBeNull();
  expect(confirmBox!.y + confirmBox!.height).toBeLessThanOrEqual(720);

  const rowBorder = await settings.locator(".setting-row").first().evaluate((node) => getComputedStyle(node).borderBottomStyle);
  expect(rowBorder).not.toBe("none");

  const order = await settings.evaluate((panel) => {
    const mode = panel.querySelector('[data-testid="training-mode-field"]');
    const level = panel.querySelector('[data-testid="training-level-field"]');
    const confirmButton = panel.querySelector('[data-testid="training-confirm"]');
    const sceneList = panel.querySelector('[data-testid="training-scene-list"]');
    if (!mode || !level || !confirmButton || !sceneList) return false;
    return Boolean(
      mode.compareDocumentPosition(level) & Node.DOCUMENT_POSITION_FOLLOWING &&
      level.compareDocumentPosition(sceneList) & Node.DOCUMENT_POSITION_FOLLOWING &&
      sceneList.compareDocumentPosition(confirmButton) & Node.DOCUMENT_POSITION_FOLLOWING
    );
  });

  expect(order).toBe(true);
});
test("training confirm button changes to confirm modification after settings change", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("nav-training").click();

  const confirm = page.getByTestId("training-confirm");
  await expect(confirm).toHaveText("确定");
  await confirm.click();
  await expect(confirm).toHaveText("确定");

  await page.getByTestId("training-mode-user-demand").click();
  await expect(confirm).toHaveText("确定修改");

  await confirm.click();
  await expect(confirm).toHaveText("确定");

  await page.getByTestId("training-level-strict").click();
  await expect(confirm).toHaveText("确定修改");
});
test("topbar does not show start training or analyze product action buttons", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByTestId("top-actions").getByRole("button", { name: "开始训练" })).toHaveCount(0);
  await expect(page.getByTestId("top-actions").getByRole("button", { name: "分析我的产品" })).toHaveCount(0);
});

test("AI training message updates only after confirming changed settings", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("nav-training").click();

  const chat = page.getByTestId("training-chat");
  await page.getByTestId("training-confirm").click();
  await expect(chat).toContainText("训练设置已确认：AI+ / 客户咨询 / 标准");

  await page.getByTestId("training-mode-user-demand").click();
  await expect(page.getByTestId("training-confirm")).toHaveText("确定修改");
  await expect(chat).toContainText("训练设置已确认：AI+ / 客户咨询 / 标准");
  await expect(chat).not.toContainText("训练设置已确认：AI+ / 用户需求提出 / 标准");

  await page.getByTestId("training-confirm").click();
  await expect(chat).toContainText("训练设置已确认：AI+ / 用户需求提出 / 标准");
});

test("training page matches the locked Demo V3 training layout", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 960 });
  await page.goto("/");
  await page.getByTestId("nav-training").click();

  await expect(page.getByRole("button", { name: "结束并评估" })).toBeVisible();
  await expect(page.getByTestId("top-actions").getByRole("button", { name: "开始训练" })).toHaveCount(0);
  await expect(page.getByTestId("top-actions").getByRole("button", { name: "分析我的产品" })).toHaveCount(0);

  const settingsBox = await page.getByTestId("training-settings").boundingBox();
  const chatBox = await page.getByTestId("training-chat").boundingBox();
  const judgementBox = await page.getByTestId("training-judgement").boundingBox();
  const confirmBox = await page.getByTestId("training-confirm").boundingBox();
  expect(settingsBox).not.toBeNull();
  expect(chatBox).not.toBeNull();
  expect(judgementBox).not.toBeNull();
  expect(confirmBox).not.toBeNull();

  expect(Math.round(settingsBox!.width)).toBeGreaterThanOrEqual(245);
  expect(Math.round(settingsBox!.width)).toBeLessThanOrEqual(255);
  expect(Math.round(judgementBox!.width)).toBeGreaterThanOrEqual(310);
  expect(Math.round(judgementBox!.width)).toBeLessThanOrEqual(325);
  expect(Math.abs(settingsBox!.y - chatBox!.y)).toBeLessThanOrEqual(2);
  expect(Math.abs(chatBox!.y - judgementBox!.y)).toBeLessThanOrEqual(2);
  expect(confirmBox!.y).toBeGreaterThan(settingsBox!.y + settingsBox!.height - 150);

  await expect(page.getByTestId("training-chat")).toContainText("当前场景：AI+ / 客户咨询 / 标准");
  await expect(page.getByTestId("training-chat")).toContainText("请选择您的训练设置。");
  await expect(page.getByTestId("training-judgement")).toContainText("查看能力画像");
  await expect(page.getByTestId("training-judgement")).toContainText("综合评分");
});

test("module03 training workbench sends answers, evaluates方案, and writes history", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("nav-training").click();

  const chat = page.getByTestId("training-chat");
  await expect(chat).toContainText("请选择您的训练设置。");

  await page.getByTestId("training-confirm").click();
  await expect(chat).toContainText("您的具体业务是什么");

  await chat.getByPlaceholder("输入你的回答...").fill("我的业务是企业 AI 培训服务");
  await chat.getByRole("button", { name: "发送" }).click();
  await expect(chat).toContainText("我的业务是企业 AI 培训服务");
  await expect(chat).toContainText("目标用户是谁、真实使用场景是什么、你希望验证的业务指标是什么");

  await chat.getByPlaceholder("输入你的回答...").fill("方案是给培训负责人提供 AI 复盘和转化率追踪");
  await chat.getByRole("button", { name: "提交方案" }).click();

  await expect(page.getByTestId("training-judgement")).toContainText("评估已生成");
  await expect(page.getByTestId("training-judgement")).toContainText("目标用户还不够具体");

  await page.getByTestId("nav-history").click();
  await expect(page.getByTestId("history-record-list")).toContainText("AI+ / 客户咨询");
  await expect(page.getByTestId("history-record-list")).toContainText("已评估");
});

test("module04 product archive saves a new product and updates AI reading", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("nav-products").click();

  await page.getByRole("button", { name: "添加产品" }).click();
  await expect(page.getByRole("heading", { name: "添加产品", exact: true })).toBeVisible();

  await page.getByLabel("产品名称").fill("餐饮库存 AI 助手");
  await page.getByLabel("产品链接").fill("https://example.com/inventory-ai");
  await page.getByLabel("目标用户").fill("中小餐饮门店老板、店长");
  await page.getByLabel("核心功能").fill("库存预警、损耗分析、补货建议");
  await page.getByLabel("产品介绍").fill("帮助中小餐饮门店识别库存损耗并自动生成补货建议。");
  await page.getByRole("button", { name: "保存产品" }).click();

  await expect(page.getByRole("heading", { name: "产品", exact: true })).toBeVisible();
  await expect(page.getByTestId("product-archive")).toContainText("餐饮库存 AI 助手");
  await expect(page.getByTestId("product-reading")).toContainText("餐饮库存 AI 助手");
  await expect(page.getByTestId("product-reading")).toContainText("中小餐饮门店老板、店长");
  await expect(page.getByTestId("product-maturity")).toContainText("成熟度评估");

  await page.getByPlaceholder("告诉 AI 哪里理解错了...").fill("还需要强调每日盘点和临期食材处理。");
  await page.getByRole("button", { name: "更新理解" }).click();
  await expect(page.getByTestId("product-reading")).toContainText("每日盘点和临期食材处理");
});

test("product archive action buttons stay black with white text", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("nav-products").click();

  const deleteButton = page.getByRole("button", { name: "删除产品" });
  await expect(deleteButton).toBeVisible();

  const styles = await deleteButton.evaluate((button) => {
    const computed = getComputedStyle(button);
    return {
      background: computed.backgroundColor,
      color: computed.color
    };
  });

  expect(styles.background).toBe("rgb(5, 7, 7)");
  expect(styles.color).toBe("rgb(255, 255, 255)");
});

test("main content action buttons are black with white text on every page", async ({ page }) => {
  async function expectBlackActionButton(name: string) {
    const button = page.getByRole("button", { name }).first();
    await expect(button).toBeVisible();
    const styles = await button.evaluate((node) => {
      const computed = getComputedStyle(node);
      return {
        background: computed.backgroundColor,
        color: computed.color
      };
    });
    expect(styles.background).toBe("rgb(5, 7, 7)");
    expect(styles.color).toBe("rgb(255, 255, 255)");
  }

  await page.goto("/");
  await expectBlackActionButton("开始训练");
  await expectBlackActionButton("分析我的产品");

  await page.getByTestId("nav-training").click();
  await expectBlackActionButton("结束并评估");
  await expectBlackActionButton("确定");
  await expectBlackActionButton("总结已知");
  await expectBlackActionButton("提交方案");
  await expectBlackActionButton("发送");
  await expectBlackActionButton("查看能力画像");

  await page.getByTestId("nav-products").click();
  await expectBlackActionButton("添加产品");
  await expectBlackActionButton("删除产品");
  await expectBlackActionButton("更新理解");

  await page.getByRole("button", { name: "添加产品" }).click();
  await expectBlackActionButton("保存产品");
  await expectBlackActionButton("取消");

  await page.getByTestId("nav-ability").click();
  await expectBlackActionButton("开始推荐训练");
});
