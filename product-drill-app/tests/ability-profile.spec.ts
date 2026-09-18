import { expect, test } from "@playwright/test";
import { enterApp, gotoView, reachFeedback } from "./e2e-helpers";

test("describes hypothesis support and counter evidence consistently", async ({ page }) => {
  await enterApp(page);
  await gotoView(page, "ability");

  await expect(page.getByText("支持证据 — 例如「独立决策时漏掉了关键调查维度」", { exact: true })).toBeVisible();
  await expect(page.getByText("反证 — 例如「某次独立决策查全了三个调查维度」", { exact: true })).toBeVisible();
});

test("shows ability evidence after a completed training", async ({ page }) => {
  await enterApp(page);
  await reachFeedback(page);
  await page.getByRole("button", { name: "完成并返回今日训练", exact: true }).click();
  await gotoView(page, "ability");
  await expect(page.getByRole("heading", { level: 1, name: "我的能力" })).toBeVisible();
  await expect(page.getByText("专项训练已留下 1 条记录", { exact: false })).toBeVisible();
  await expect(page.locator(".ability-counts span", { hasText: "条练习证据" }).first()).toBeVisible();
  await expect(page.getByText("当前状态包含练习反馈", { exact: false })).toBeVisible();
  await expect(page.locator(".ability-table article")).toHaveCount(5);
});

test("ability names render on a single line at desktop width", async ({ page }) => {
  await enterApp(page);
  await gotoView(page, "ability");

  const name = page.locator(".ability-table > article").first().locator("h3");
  const box = await name.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.height).toBeLessThan(40);
  expect(box!.width).toBeGreaterThan(200);
});

test("creates a local team and exposes an invite code", async ({ page }) => {
  await enterApp(page);
  await gotoView(page, "ability");
  await page.getByLabel("团队名称").fill("产品训练小组");
  await page.getByRole("button", { name: "创建团队", exact: true }).click();
  await expect(page.getByTestId("team-workspace-panel")).toContainText("产品训练小组");
  await expect(page.getByTestId("team-invite-code")).toHaveText(/^[A-Z0-9]{8}$/);
  await expect(page.getByText("本地试用", { exact: true })).toBeVisible();
});
