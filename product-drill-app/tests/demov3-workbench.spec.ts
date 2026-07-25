import { expect, test } from "@playwright/test";

test("demov3 workbench entry keeps the total acceptance route separate and runs the training flow", async ({ page }) => {
  await page.goto("/demov3-workbench");

  await expect(page.getByRole("heading", { level: 1, name: "训练工作台" })).toBeVisible();
  await expect(page.getByText("Demo V3 交互重构测试入口")).toBeVisible();
  await expect(page.getByTestId("v3live-start")).toBeVisible();
  await expect(page.locator(".v3live-score")).toContainText("60 / 100");

  await page.getByTestId("v3live-start").click();
  await expect(page.locator(".v3live-message.ai")).toHaveCount(1);
  await expect(page.locator(".v3live-message.ai")).toContainText("我们现在看经营情况太麻烦了");

  await page.getByRole("button", { name: "独立" }).click();
  await expect(page.locator(".v3live-message")).toHaveCount(0);
  await page.getByTestId("v3live-start").click();

  await page.getByPlaceholder("输入你的回答，Enter 发送").fill("我的业务是AI+服务");
  await page.getByTestId("v3live-send").click();

  await expect(page.locator(".v3live-message.user").getByText("我的业务是AI+服务")).toBeVisible();
  await expect(page.locator(".v3live-message.ai")).toHaveCount(2);

  await page.getByPlaceholder("输入你的回答，Enter 发送").fill("这是我的解决方案");
  await page.getByTestId("v3live-submit").click();
  await expect(page.getByRole("heading", { name: "综合评分" })).toBeVisible();
  await expect(page.locator(".v3live-score")).toContainText("/ 100");
  await expect(page.getByText("过早进入解决方案")).toBeVisible();
});

test("demov3 product module supports list, detail, add, and save flow", async ({ page }) => {
  await page.goto("/demov3-workbench");

  await page.getByTestId("v3live-nav-product").click();

  await expect(page.getByTestId("v3live-product-list")).toBeVisible();
  await expect(page.getByTestId("v3live-product-add")).toBeVisible();
  await expect(page.getByTestId("v3live-product-center")).toBeVisible();
  await expect(page.getByTestId("v3live-product-maturity")).toBeVisible();

  await page.getByTestId("v3live-product-row-training-ai").click();
  await expect(page.getByTestId("v3live-product-detail")).toBeVisible();
  await expect(page.getByTestId("v3live-product-center")).toContainText("AI 产品解读");
  await expect(page.getByTestId("v3live-product-maturity")).toContainText("成熟度评估");

  await page.getByTestId("v3live-product-add").click();
  await expect(page.getByTestId("v3live-product-form")).toBeVisible();
  await expect(page.getByTestId("v3live-upload-doc")).toBeVisible();
  await expect(page.getByTestId("v3live-upload-code")).toBeVisible();
  await expect(page.getByText("AI 追问与澄清")).toBeVisible();

  await page.getByTestId("v3live-product-name").fill("新产品样例");
  await page.getByTestId("v3live-product-users").fill("中小企业产品负责人");
  await page.getByTestId("v3live-product-description").fill("帮助用户训练需求判断、客户咨询和方案表达。");
  await page.getByTestId("v3live-product-save").click();

  await expect(page.getByTestId("v3live-product-list")).toContainText("新产品样例");
});

test("demov3 product module deletes a selected product after entering delete mode", async ({ page }) => {
  await page.goto("/demov3-workbench");

  await page.getByTestId("v3live-nav-product").click();
  await expect(page.getByTestId("v3live-product-row-store-inventory")).toBeVisible();

  await page.getByTestId("v3live-product-delete").click();
  await expect(page.getByTestId("v3live-product-delete")).toHaveAttribute("data-delete-mode", "true");

  await page.getByTestId("v3live-product-row-store-inventory").click();
  await page.getByTestId("v3live-product-delete").click();

  await expect(page.getByTestId("v3live-product-row-store-inventory")).toHaveCount(0);
  await expect(page.getByTestId("v3live-product-row-training-ai")).toBeVisible();
});

test("demov3 history module switches records and updates the review panel", async ({ page }) => {
  await page.goto("/demov3-workbench");

  await page.getByTestId("v3live-nav-history").click();

  await expect(page.getByRole("heading", { level: 1, name: "对话历史" })).toBeVisible();
  await expect(page.getByTestId("v3live-history-list")).toBeVisible();
  await expect(page.getByTestId("v3live-history-review")).toBeVisible();
  await expect(page.getByTestId("v3live-history-review")).toContainText("企业培训服务需求澄清");

  await page.getByTestId("v3live-history-record-store").click();

  await expect(page.getByTestId("v3live-history-review")).toContainText("门店库存损耗方案");
  await expect(page.getByTestId("v3live-history-score")).toContainText("76 / 100");
});
