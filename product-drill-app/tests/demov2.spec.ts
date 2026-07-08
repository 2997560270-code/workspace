import { expect, test } from "@playwright/test";

const text = {
  home: "\u9996\u9875",
  productIntro: "\u4ea7\u54c1\u4ecb\u7ecd",
  coreFeatures: "\u6838\u5fc3\u529f\u80fd",
  userTrainingData: "\u7528\u6237\u8bad\u7ec3\u6570\u636e",
  trainingGrowth: "\u8bad\u7ec3\u589e\u957f",
  workbench: "\u5de5\u4f5c\u53f0",
  collapseSidebar: "\u6536\u8d77\u4fa7\u8fb9\u680f",
  oldPrevSlide: "\u4e0a\u4e00\u9875",
  oldNextSlide: "\u4e0b\u4e00\u9875",
  nextSlide: "\u5411\u53f3\u7ffb\u9875",
  productAnalysis: "\u81ea\u6709\u4ea7\u54c1\u5206\u6790",
  productProfile: "\u4ea7\u54c1\u8d44\u6599 \u00b7 Product Profile",
  evaluationProfile: "\u65b9\u6848\u8bc4\u4f30\u4e0e\u80fd\u529b\u753b\u50cf",
  abilityDimension: "\u80fd\u529b\u7ef4\u5ea6\u8868\u73b0",
  needUnderstanding: "\u9700\u6c42\u7406\u89e3",
  aiChat: "AI \u5bf9\u8bdd",
  aiReview: "AI \u70b9\u8bc4",
  startTraining: "\u5f00\u59cb\u8bad\u7ec3",
  send: "\u53d1\u9001",
  submitSolution: "\u63d0\u4ea4\u65b9\u6848",
  scoreHeading: "\u7efc\u5408\u8bc4\u5206",
  userBusiness: "\u6211\u7684\u4e1a\u52a1\u662fAI+\u670d\u52a1",
  myProduct: "\u6211\u7684\u4ea7\u54c1",
  productFile: "\u4ea7\u54c1\u6587\u4ef6",
  addProduct: "\u6dfb\u52a0\u4ea7\u54c1",
  aiInterpretation: "AI \u89e3\u8bfb",
  maturity: "AI \u4ea7\u54c1\u6210\u719f\u5ea6\u8bc4\u4f30",
  clarify: "\u5411 AI \u8bf4\u660e\u5e76\u4fee\u6539",
  uploadDoc: "\u4e0a\u4f20\u4ea7\u54c1\u6587\u6863",
  uploadCode: "\u4e0a\u4f20\u6e90\u4ee3\u7801",
  aiQuestions: "AI \u8ffd\u95ee\u4e0e\u6f84\u6e05",
  aiProductSummary: "AI \u5bf9\u4ea7\u54c1\u7684\u521d\u6b65\u7406\u89e3",
  saveProduct: "\u4fdd\u5b58\u4ea7\u54c1",
  productNameLabel: "\u4ea7\u54c1\u540d\u79f0",
  newProduct: "\u65b0\u4ea7\u54c1\u6837\u4f8b",
};

test("demov2 shows the home page and collapses the sidebar", async ({ page }) => {
  await page.goto("/demov2");

  await expect(page.getByRole("heading", { level: 1, name: text.home })).toBeVisible();
  await expect(page.getByRole("heading", { name: text.productIntro })).toBeVisible();
  await expect(page.getByRole("heading", { name: text.coreFeatures })).toBeVisible();
  await expect(page.getByRole("heading", { name: text.userTrainingData })).toBeVisible();
  await expect(page.getByRole("heading", { name: text.trainingGrowth })).toBeVisible();
  await expect(page.getByRole("button", { name: text.workbench })).toBeVisible();

  await page.getByRole("button", { name: text.collapseSidebar }).click();

  await expect(page.getByRole("button", { name: text.workbench })).toHaveClass(/icon-only/);
  await expect(page.locator(".v2-sidebar")).toHaveClass(/collapsed/);
});

test("demov2 feature slide keeps preview and copy in sync", async ({ page }) => {
  await page.goto("/demov2");

  await expect(page.getByRole("button", { name: text.oldPrevSlide })).toHaveCount(0);
  await expect(page.getByRole("button", { name: text.oldNextSlide })).toHaveCount(0);
  await page.getByRole("button", { name: text.nextSlide }).click();

  await expect(page.getByRole("heading", { name: text.productAnalysis })).toBeVisible();
  await expect(page.getByText(text.productProfile)).toBeVisible();

  await page.getByRole("button", { name: text.nextSlide }).click();

  await expect(page.getByRole("heading", { name: text.evaluationProfile })).toBeVisible();
  await expect(page.getByText(text.abilityDimension)).toBeVisible();
  await expect(page.getByText(text.needUnderstanding)).toBeVisible();
});

test("demov2 workbench uses demo training conversation flow", async ({ page }) => {
  await page.goto("/demov2");
  await page.getByRole("button", { name: text.workbench }).click();

  await expect(page.getByRole("heading", { name: text.aiChat })).toBeVisible();
  await expect(page.getByRole("heading", { name: text.aiReview })).toHaveCount(0);
  await expect(page.locator(".v2-chat-list .v2-bubble")).toHaveCount(0);

  await page.locator(".v2-settings-panel").getByRole("button", { name: text.startTraining }).click();
  await expect(page.locator(".v2-chat-list .v2-bubble")).toHaveCount(1);

  await page.getByPlaceholder(/\u8f93\u5165\u4f60\u7684\u56de\u590d/).fill(text.userBusiness);
  await page.getByRole("button", { name: text.send }).click();
  await expect(page.locator(".v2-bubble.user").getByText(text.userBusiness, { exact: true })).toBeVisible();

  await page.getByPlaceholder(/\u8f93\u5165\u4f60\u7684\u56de\u590d/).fill("\u8fd9\u662f\u6211\u7684\u89e3\u51b3\u65b9\u6848");
  await page.getByRole("button", { name: text.submitSolution }).click();
  await expect(page.getByRole("heading", { name: text.scoreHeading })).toBeVisible();
});

test("demov2 product page supports list, detail, add, and save flow", async ({ page }) => {
  await page.goto("/demov2");
  await page.getByRole("button", { exact: true, name: text.myProduct }).click();

  await expect(page.getByRole("heading", { name: text.productFile })).toBeVisible();
  await expect(page.getByRole("button", { name: text.addProduct })).toBeVisible();

  await page.locator(".v2-product-file-list button").first().click();

  await expect(page.getByRole("heading", { name: text.aiInterpretation })).toBeVisible();
  await expect(page.getByRole("heading", { name: text.maturity })).toBeVisible();
  await expect(page.getByPlaceholder(text.clarify)).toBeVisible();

  await page.getByRole("button", { name: text.addProduct }).click();

  await expect(page.getByLabel(text.uploadDoc)).toBeVisible();
  await expect(page.getByLabel(text.uploadCode)).toBeVisible();
  await expect(page.getByRole("heading", { name: text.aiQuestions })).toBeVisible();
  await expect(page.getByText(text.aiProductSummary)).toBeVisible();

  await page.getByLabel(text.productNameLabel).fill(text.newProduct);
  await page.getByRole("button", { name: text.saveProduct }).click();

  await expect(page.getByRole("button", { name: text.newProduct })).toBeVisible();
});
