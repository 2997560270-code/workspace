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

test("module05 keeps saved products after browser reload", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByTestId("nav-products").click();
  await page.getByRole("button", { name: "添加产品" }).click();
  await page.getByLabel("产品名称").fill("刷新保留的库存产品");
  await page.getByLabel("产品链接").fill("https://example.com/persisted-product");
  await page.getByLabel("目标用户").fill("连锁餐饮门店店长");
  await page.getByLabel("核心功能").fill("库存预警、补货提醒、损耗复盘");
  await page.getByLabel("产品介绍").fill("帮助门店店长减少库存损耗并建立每日盘点流程。");
  await page.getByRole("button", { name: "保存产品" }).click();

  await expect(page.getByTestId("product-archive")).toContainText("刷新保留的库存产品");

  await page.reload();
  await page.getByTestId("nav-products").click();
  await expect(page.getByTestId("product-archive")).toContainText("刷新保留的库存产品");
  await expect(page.getByTestId("product-reading")).toContainText("刷新保留的库存产品");
});

test("module05 keeps training history after browser reload", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByTestId("nav-history").click();
  await expect(page.getByTestId("history-record-list").locator("button")).toHaveCount(6);

  await page.getByTestId("nav-training").click();
  await page.getByTestId("training-confirm").click();
  await page.getByPlaceholder("输入你的回答...").fill("我的业务是企业 AI 培训服务");
  await page.getByRole("button", { name: "发送" }).click();
  await page.getByPlaceholder("输入你的回答...").fill("方案是给培训负责人提供 AI 复盘和转化率追踪");
  await page.getByRole("button", { name: "提交方案" }).click();

  await page.reload();
  await page.getByTestId("nav-history").click();
  await expect(page.getByTestId("history-record-list").locator("button")).toHaveCount(7);
});


test("module05 ability profile uses real completed training count", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByTestId("nav-training").click();
  await page.getByTestId("training-confirm").click();
  await page.getByPlaceholder("输入你的回答...").fill("我的业务是企业 AI 培训服务");
  await page.getByRole("button", { name: "发送" }).click();
  await page.getByPlaceholder("输入你的回答...").fill("方案是给培训负责人提供 AI 复盘和转化率追踪");
  await page.getByRole("button", { name: "提交方案" }).click();

  await page.getByTestId("nav-ability").click();
  await expect(page.getByTestId("ability-page")).toContainText("完成训练 · 真实记录 1");
  await expect(page.getByTestId("ability-page")).toContainText("目标用户还不够具体");
});
test("module05 accumulates multiple training attempts after reload", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  async function completeTraining(business: string, solution: string) {
    await page.getByTestId("nav-training").click();
    await page.getByTestId("training-confirm").click();
    await page.getByPlaceholder("输入你的回答...").fill(business);
    await page.getByRole("button", { name: "发送" }).click();
    await page.getByPlaceholder("输入你的回答...").fill(solution);
    await page.getByRole("button", { name: "提交方案" }).click();
  }

  await completeTraining("我的业务是企业 AI 培训服务", "方案是提供训练复盘和指标看板");
  await page.reload();
  await completeTraining("我的业务是门店库存管理", "方案是提供库存预警和损耗分析");

  await page.getByTestId("nav-history").click();
  await expect(page.getByTestId("history-record-list").locator("button")).toHaveCount(8);

  await page.getByTestId("nav-ability").click();
  await expect(page.getByTestId("ability-page")).toContainText("完成训练 · 真实记录 2");
});
test("ability trend chart amplifies close score changes", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    const dimensions = ["需求理解", "问题澄清", "方案设计", "异议应对", "商业价值论证", "数据与逻辑", "表达与沟通"];
    const makeRecord = (id: string, totalScore: number) => ({
      id,
      title: "AI+ / 客户咨询",
      scenario: "AI+",
      mode: "客户咨询",
      totalScore,
      messages: [{ id: `${id}-msg`, role: "user", content: "测试记录" }],
      evaluation: {
        totalScore,
        dimensions: dimensions.map((name) => ({ name, score: totalScore })),
        issues: ["趋势测试短板"]
      }
    });
    localStorage.setItem("product-drill:mvp:history-records", JSON.stringify([
      makeRecord("history-low", 3.5),
      makeRecord("history-high", 4.0)
    ]));
  });
  await page.reload();
  await page.getByTestId("nav-ability").click();

  const points = await page.locator(".ability-main .chart polyline").first().getAttribute("points");
  const yValues = points!.split(" ").map((point) => Number(point.split(",")[1]));
  const verticalRange = Math.max(...yValues) - Math.min(...yValues);

  expect(verticalRange).toBeGreaterThanOrEqual(90);
});
test("ability trend chart shows axis parameters and variation range", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    const dimensions = ["需求理解", "问题澄清", "方案设计", "异议应对", "商业价值论证", "数据与逻辑", "表达与沟通"];
    const makeRecord = (id: string, totalScore: number) => ({
      id,
      title: "AI+ / 客户咨询",
      scenario: "AI+",
      mode: "客户咨询",
      totalScore,
      messages: [{ id: `${id}-msg`, role: "user", content: "测试记录" }],
      evaluation: {
        totalScore,
        dimensions: dimensions.map((name) => ({ name, score: totalScore })),
        issues: ["趋势测试短板"]
      }
    });
    localStorage.setItem("product-drill:mvp:history-records", JSON.stringify([
      makeRecord("history-1", 3.2),
      makeRecord("history-2", 3.9),
      makeRecord("history-3", 4.1)
    ]));
  });
  await page.reload();
  await page.getByTestId("nav-ability").click();

  await expect(page.getByTestId("ability-trend-panel")).toContainText("分数轴");
  await expect(page.getByTestId("ability-trend-panel")).toContainText("训练轮次");
  await expect(page.getByTestId("ability-trend-panel")).toContainText("变化幅度 18 分");
  await expect(page.getByTestId("ability-trend-panel")).toContainText("第 1 次");
  await expect(page.getByTestId("ability-trend-panel")).toContainText("第 3 次");
});
test("module06 history detail follows selected record and creates review report", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    const dimensions = ["需求理解", "问题澄清", "方案设计", "异议应对", "商业价值论证", "数据与逻辑", "表达与沟通"];
    const makeRecord = (id: string, title: string, scenario: string, mode: string, totalScore: number, userText: string, issue: string) => ({
      id,
      title,
      scenario,
      mode,
      totalScore,
      messages: [
        { id: `${id}-ai`, role: "ai", content: `AI 针对 ${scenario} 进行追问` },
        { id: `${id}-user`, role: "user", content: userText }
      ],
      evaluation: {
        totalScore,
        dimensions: dimensions.map((name) => ({ name, score: totalScore })),
        issues: [issue]
      }
    });
    localStorage.setItem("product-drill:mvp:history-records", JSON.stringify([
      makeRecord("history-review-1", "AI+ / 客户咨询", "AI+", "客户咨询", 3.2, "第一条用户输入", "第一条问题"),
      makeRecord("history-review-2", "制造业 CRM / 方案评估", "B2B", "方案评估", 4.1, "第二条用户输入", "第二条问题")
    ]));
  });
  await page.reload();

  await page.getByTestId("nav-history").click();
  await page.getByRole("button", { name: /制造业 CRM \/ 方案评估/ }).click();

  await expect(page.getByTestId("history-review-panel")).toContainText("制造业 CRM / 方案评估");
  await expect(page.getByTestId("history-review-panel")).toContainText("场景：B2B | 模式：方案评估");
  await expect(page.getByTestId("history-review-panel")).toContainText("4.1 / 5");
  await expect(page.getByTestId("history-review-panel")).toContainText("第二条用户输入");
  await expect(page.getByTestId("history-review-panel")).toContainText("第二条问题");

  await page.getByRole("button", { name: "生成复盘报告" }).click();
  await expect(page.getByTestId("history-review-panel")).toContainText("复盘报告已生成");

  await page.getByRole("button", { name: "重新训练此场景" }).click();
  await expect(page.getByRole("heading", { name: "训练", exact: true })).toBeVisible();
});
test("retraining from history restores previous chat and shows a black primary action", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    const dimensions = ["需求理解", "问题澄清", "方案设计", "异议应对", "商业价值论证", "数据与逻辑", "表达与沟通"];
    localStorage.setItem("product-drill:mvp:history-records", JSON.stringify([
      {
        id: "history-resume-1",
        title: "B2B / 客户咨询",
        scenario: "B2B",
        mode: "客户咨询",
        totalScore: 3.6,
        messages: [
          { id: "resume-ai-1", role: "ai", content: "AI 原始追问：你的业务场景是什么？" },
          { id: "resume-user-1", role: "user", content: "历史用户回答：我的业务是采购协同系统" },
          { id: "resume-ai-2", role: "ai", content: "AI 原始追问：谁每天使用这个系统？" }
        ],
        evaluation: {
          totalScore: 3.6,
          dimensions: dimensions.map((name) => ({ name, score: 3.6 })),
          issues: ["历史问题：目标用户仍需收窄"]
        }
      }
    ]));
  });
  await page.reload();
  await page.getByTestId("nav-history").click();

  const retrainButton = page.getByRole("button", { name: "重新训练此场景" });
  await expect(retrainButton).toBeVisible();
  await expect(retrainButton).toHaveCSS("background-color", "rgb(5, 7, 12)");
  await expect(retrainButton).toHaveCSS("color", "rgb(255, 255, 255)");

  await retrainButton.click();
  await expect(page.getByRole("heading", { name: "训练", exact: true })).toBeVisible();
  await expect(page.getByTestId("training-chat")).toContainText("历史用户回答：我的业务是采购协同系统");
  await expect(page.getByTestId("training-chat")).toContainText("AI 原始追问：谁每天使用这个系统？");
  await expect(page.getByTestId("training-chat")).toContainText("已载入历史训练记录，可以在原对话基础上继续训练。");
});
test("training industry select shows selected feedback after switching scenario", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("nav-training").click();

  const industrySelect = page.getByTestId("training-industry-select");
  await industrySelect.selectOption("B2B");

  await expect(industrySelect).toHaveValue("B2B");
  await expect(industrySelect).toHaveClass(/selected/);
  await expect(industrySelect).toHaveCSS("background-color", "rgb(231, 244, 239)");
  await expect(industrySelect).toHaveCSS("border-color", "rgb(167, 210, 194)");
});


test("training scene list shows selected feedback after switching scene", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("nav-training").click();

  const sceneList = page.getByTestId("training-scene-list");
  const salesScene = sceneList.getByRole("button", { name: /销售知识库/ });
  await salesScene.click();

  await expect(salesScene).toHaveClass(/active/);
  await expect(salesScene).toHaveCSS("background-color", "rgb(231, 244, 239)");
  await expect(salesScene).toHaveCSS("border-color", "rgb(167, 210, 194)");
});

test("module07 product archive deletes selected product and persists deletion", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  async function addProduct(name: string, targetUsers: string) {
    await page.getByTestId("nav-products").click();
    await page.getByRole("button", { name: "添加产品" }).click();
    await page.getByLabel("产品名称").fill(name);
    await page.getByLabel("产品链接").fill(`https://example.com/${name}`);
    await page.getByLabel("目标用户").fill(targetUsers);
    await page.getByLabel("核心功能").fill("库存预警、损耗分析、补货建议");
    await page.getByLabel("产品介绍").fill(`${name} 用于验证产品删除流程。`);
    await page.getByRole("button", { name: "保存产品" }).click();
    await expect(page.getByRole("heading", { name: "产品", exact: true })).toBeVisible();
  }

  await addProduct("待删除库存产品", "中小餐饮店长");
  await addProduct("保留培训产品", "企业培训负责人");

  await expect(page.getByTestId("product-archive")).toContainText("待删除库存产品");
  await expect(page.getByTestId("product-archive")).toContainText("保留培训产品");

  await page.getByRole("button", { name: "删除产品", exact: true }).click();
  await expect(page.getByRole("button", { name: "删除", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /待删除库存产品/ }).click();
  await page.getByRole("button", { name: "删除", exact: true }).click();

  await expect(page.getByTestId("product-archive")).not.toContainText("待删除库存产品");
  await expect(page.getByTestId("product-archive")).toContainText("保留培训产品");
  await expect(page.getByTestId("product-reading")).toContainText("保留培训产品");

  await page.reload();
  await page.getByTestId("nav-products").click();
  await expect(page.getByTestId("product-archive")).not.toContainText("待删除库存产品");
  await expect(page.getByTestId("product-reading")).toContainText("保留培训产品");
});

test("module07 product archive supports multi-select deletion", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  async function addProduct(name: string) {
    await page.getByTestId("nav-products").click();
    await page.getByRole("button", { name: "添加产品" }).click();
    await page.getByLabel("产品名称").fill(name);
    await page.getByLabel("产品链接").fill(`https://example.com/${name}`);
    await page.getByLabel("目标用户").fill("企业培训负责人");
    await page.getByLabel("核心功能").fill("AI 解读、追问澄清、成熟度评估");
    await page.getByLabel("产品介绍").fill(`${name} 用于验证多选删除流程。`);
    await page.getByRole("button", { name: "保存产品" }).click();
    await expect(page.getByRole("heading", { name: "产品", exact: true })).toBeVisible();
  }

  await addProduct("多选删除产品A");
  await addProduct("多选删除产品B");
  await addProduct("多选保留产品C");

  await page.getByRole("button", { name: "删除产品", exact: true }).click();
  await page.getByRole("button", { name: /多选删除产品A/ }).click();
  await page.getByRole("button", { name: /多选删除产品B/ }).click();

  await expect(page.getByRole("button", { name: /多选删除产品A/ })).toHaveClass(/delete-selected/);
  await expect(page.getByRole("button", { name: /多选删除产品B/ })).toHaveClass(/delete-selected/);

  await page.getByRole("button", { name: "删除", exact: true }).click();

  await expect(page.getByTestId("product-archive")).not.toContainText("多选删除产品A");
  await expect(page.getByTestId("product-archive")).not.toContainText("多选删除产品B");
  await expect(page.getByTestId("product-archive")).toContainText("多选保留产品C");
  await expect(page.getByTestId("product-reading")).toContainText("多选保留产品C");

  await page.reload();
  await page.getByTestId("nav-products").click();
  await expect(page.getByTestId("product-archive")).not.toContainText("多选删除产品A");
  await expect(page.getByTestId("product-archive")).not.toContainText("多选删除产品B");
  await expect(page.getByTestId("product-reading")).toContainText("多选保留产品C");
});


test("product archive keeps horizontal layout after entering delete mode", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByTestId("nav-products").click();
  await page.getByRole("button", { name: "添加产品" }).click();
  await page.getByLabel("产品名称").fill("企业 AI 培训助手");
  await page.getByLabel("产品链接").fill("https://example.com/layout-product");
  await page.getByLabel("目标用户").fill("企业培训负责人");
  await page.getByLabel("核心功能").fill("AI 解读、追问澄清、成熟度评估");
  await page.getByLabel("产品介绍").fill("用于验证删除模式下产品档案排版不变形。");
  await page.getByRole("button", { name: "保存产品" }).click();

  const productButton = page.getByRole("button", { name: /企业 AI 培训助手/ }).first();
  const productName = productButton.locator("strong");
  const beforeBox = await productName.boundingBox();
  expect(beforeBox).not.toBeNull();

  await page.getByRole("button", { name: "删除产品", exact: true }).click();
  const afterBox = await productName.boundingBox();
  expect(afterBox).not.toBeNull();
  expect(afterBox!.width).toBeGreaterThan(100);
  expect(afterBox!.height).toBeLessThan(36);
});

test("module08 product uploads prefill add product form from document and source text", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByTestId("nav-products").click();
  await page.getByRole("button", { name: "添加产品" }).click();

  await page.getByLabel("上传产品文档").setInputFiles({
    name: "prd.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("产品名称：餐饮门店库存助手\n目标用户：中小餐饮门店店长\n产品介绍：帮助门店记录库存、识别损耗并提醒补货。", "utf-8")
  });
  await page.getByLabel("上传源代码").setInputFiles({
    name: "features.ts",
    mimeType: "text/plain",
    buffer: Buffer.from("核心功能：库存预警、损耗分析、补货建议、经营数据复盘", "utf-8")
  });

  await expect(page.getByLabel("产品名称")).toHaveValue("餐饮门店库存助手");
  await expect(page.getByLabel("目标用户")).toHaveValue("中小餐饮门店店长");
  await expect(page.getByLabel("核心功能")).toHaveValue(/库存预警/);
  await expect(page.getByLabel("产品介绍")).toHaveValue(/识别损耗/);
  await expect(page.getByTestId("add-product-ai-clarification")).toContainText("已读取产品文档：prd.txt");
  await expect(page.getByTestId("add-product-ai-clarification")).toContainText("已读取源代码：features.ts");

  await page.getByRole("button", { name: "保存产品" }).click();
  await expect(page.getByTestId("product-archive")).toContainText("餐饮门店库存助手");
  await expect(page.getByTestId("product-reading")).toContainText("餐饮门店库存助手");
});

test("module09 product profile can be edited and regenerates AI reading", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByTestId("nav-products").click();
  await page.getByRole("button", { name: "添加产品" }).click();
  await page.getByLabel("产品名称").fill("原始库存产品");
  await page.getByLabel("产品链接").fill("https://example.com/original-inventory");
  await page.getByLabel("目标用户").fill("餐饮店长");
  await page.getByLabel("核心功能").fill("库存记录");
  await page.getByLabel("产品介绍").fill("帮助门店记录库存。");
  await page.getByRole("button", { name: "保存产品" }).click();

  await page.getByRole("button", { name: "编辑产品资料" }).click();
  await page.getByLabel("产品名称").fill("编辑后的库存产品");
  await page.getByLabel("目标用户").fill("中小餐饮门店店长");
  await page.getByLabel("核心功能").fill("库存预警、损耗分析、补货建议");
  await page.getByLabel("产品介绍").fill("帮助店长减少库存损耗并提升补货效率。");
  await page.getByRole("button", { name: "保存修改" }).click();

  await expect(page.getByTestId("product-archive")).toContainText("编辑后的库存产品");
  await expect(page.getByTestId("product-archive")).not.toContainText("原始库存产品");
  await expect(page.getByTestId("product-reading")).toContainText("编辑后的库存产品");
  await expect(page.getByTestId("product-reading")).toContainText("中小餐饮门店店长");
  await expect(page.getByTestId("product-reading")).toContainText("库存预警、损耗分析、补货建议");

  await page.reload();
  await page.getByTestId("nav-products").click();
  await expect(page.getByTestId("product-archive")).toContainText("编辑后的库存产品");
  await expect(page.getByTestId("product-reading")).toContainText("帮助店长减少库存损耗并提升补货效率");
});


test("product detail meta uses Chinese colons instead of question marks", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByTestId("nav-products").click();
  await page.getByRole("button", { name: "添加产品" }).click();
  await page.getByLabel("产品名称").fill("格式校验产品");
  await page.getByLabel("产品链接").fill("https://example.com/meta-format");
  await page.getByLabel("目标用户").fill("企业培训负责人");
  await page.getByLabel("核心功能").fill("AI 解读、追问澄清");
  await page.getByLabel("产品介绍").fill("用于校验产品详情元信息格式。");
  await page.getByRole("button", { name: "保存产品" }).click();

  const meta = page.getByTestId("product-reading").locator(".meta").first();
  await expect(meta).toContainText("阶段：MVP 验证中");
  await expect(meta).toContainText("目标用户：企业培训负责人");
  await expect(meta).toContainText("链接：https://example.com/meta-format");
  await expect(meta).not.toContainText("阶段?");
  await expect(meta).not.toContainText("目标用户?");
  await expect(meta).not.toContainText("链接?");
});

test("module10 usage guide appears on hover and closes when pointer leaves", async ({ page }) => {
  await page.goto("/");

  const guideButton = page.getByRole("button", { name: "使用指南" });
  await expect(page.getByTestId("usage-guide-panel")).toHaveCount(0);

  await guideButton.hover();
  await expect(page.getByTestId("usage-guide-panel")).toBeVisible();
  await expect(page.getByTestId("usage-guide-panel")).toContainText("三步使用 Product Drill");
  await expect(page.getByTestId("usage-guide-panel")).toContainText("选择训练设置");
  await expect(page.getByTestId("usage-guide-panel")).toContainText("提交方案生成评估");

  await page.getByTestId("usage-guide-panel").hover();
  await expect(page.getByTestId("usage-guide-panel")).toBeVisible();
  await expect(page.getByTestId("side-nav")).toHaveCSS("width", "232px");
  await expect(page.getByTestId("side-nav").getByText("Product Drill")).toBeVisible();

  await page.mouse.move(900, 120);
  await expect(page.getByTestId("usage-guide-panel")).toHaveCount(0);
});

test("module10 hovered usage guide can jump to training and product pages", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "使用指南" }).hover();
  await page.getByTestId("usage-guide-panel").hover();
  await page.getByRole("button", { name: "去训练" }).click();
  await expect(page.getByRole("heading", { name: "训练", exact: true })).toBeVisible();
  await expect(page.getByTestId("usage-guide-panel")).toHaveCount(0);

  await page.getByRole("button", { name: "使用指南" }).hover();
  await page.getByTestId("usage-guide-panel").hover();
  await page.getByRole("button", { name: "分析产品" }).click();
  await expect(page.getByRole("heading", { name: "产品", exact: true })).toBeVisible();
  await expect(page.getByTestId("usage-guide-panel")).toHaveCount(0);
});

test("module11 history search filters records by keyword", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("nav-history").click();

  await expect(page.getByTestId("history-record-list")).toContainText("门店库存损耗方案");
  await page.getByLabel("搜索历史").fill("门店库存");

  await expect(page.getByTestId("history-record-list")).toContainText("门店库存损耗方案");
  await expect(page.getByTestId("history-record-list")).not.toContainText("企业培训服务需求澄清");
});


test("module11 history filter chips render as visible pill buttons", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("nav-history").click();

  const pendingChip = page.getByRole("button", { name: "\u5f85\u590d\u76d8", exact: true });
  await expect(pendingChip).toBeVisible();
  await expect(pendingChip).toHaveCSS("border-radius", "999px");
  const borderTopWidth = await pendingChip.evaluate((element) => Number.parseFloat(getComputedStyle(element).borderTopWidth));
  expect(borderTopWidth).toBeGreaterThanOrEqual(1);
});

test("module11 history status chips filter records and update empty state", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("nav-history").click();

  await page.getByRole("button", { name: "待复盘", exact: true }).click();
  await expect(page.getByTestId("history-record-list")).toContainText("学习路径设计复盘");
  await expect(page.getByTestId("history-record-list")).toContainText("自有产品定位澄清");
  await expect(page.getByTestId("history-record-list")).not.toContainText("销售知识库价值验证");

  await page.getByLabel("搜索历史").fill("不存在的记录");
  await expect(page.getByTestId("history-record-list")).toContainText("没有找到匹配的训练记录");
});
