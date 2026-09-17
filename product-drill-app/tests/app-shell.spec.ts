import { expect, test } from "@playwright/test";
import { enterApp, gotoView, UI_LABELS } from "./e2e-helpers";

test("navigates between the four direction A modules", async ({ page }) => {
  await enterApp(page);
  await expect(page.getByTestId("weekly-summary")).toContainText("建立你的能力基线");
  // copy guard：导航按钮仍须向用户暴露 label 与 hint 文案
  await expect(page.getByTestId("nav-map")).toContainText("训练地图");
  await expect(page.getByTestId("nav-map")).toContainText("按能力选择训练任务");
  const cases = [
    ["map", "训练地图"],
    ["review", "复盘与复练"],
    ["ability", "我的能力"],
    ["today", UI_LABELS.todayHeading]
  ] as const;
  for (const [view, heading] of cases) {
    await gotoView(page, view);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  }
});

test("keeps the ability view within the mobile viewport", async ({ page }) => {
  await enterApp(page);
  await page.setViewportSize({ width: 375, height: 844 });
  await gotoView(page, "ability");

  const widths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth
  }));

  expect(widths.scroll).toBe(widths.client);
});

test("keeps the world workbench heading in the mobile viewport", async ({ page }) => {
  await enterApp(page);
  await page.setViewportSize({ width: 375, height: 600 });
  await page.evaluate(() => {
    document.body.style.minHeight = "2000px";
    window.scrollTo(0, 500);
  });
  await page.getByTestId("open-world-workbench").click();

  await expect(page.getByRole("heading", { level: 1, name: "世界工作台" })).toBeInViewport();
});
