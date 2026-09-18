import { expect, test } from "@playwright/test";
import { enterApp } from "./e2e-helpers";

// 100% 缩放（1366×768）是笔记本最常见视口：此前 e2e 默认 1280×720 走 ≤1180
// 两列分支，三列桌面布局长期漏测，导致 composer 按钮被压到 CJK 竖排断行。
test.use({ viewport: { width: 1366, height: 768 } });

test("training workspace keeps composer controls and coverage count readable at 100% zoom", async ({ page }) => {
  await enterApp(page);
  await page.getByTestId("start-today-training").click();
  const send = page.getByTestId("send-reply");
  await send.waitFor();

  const sendBox = await send.boundingBox();
  const voiceBox = await page.locator(".voice-input-button").boundingBox();
  const hintBox = await page.getByTestId("request-hint").boundingBox();
  expect(sendBox).not.toBeNull();
  expect(voiceBox).not.toBeNull();
  expect(hintBox).not.toBeNull();
  // 单行高度阈值：按钮一旦竖排断行高度会跳到 56px 以上。
  expect(sendBox!.height).toBeLessThan(56);
  expect(voiceBox!.height).toBeLessThan(48);
  expect(hintBox!.height).toBeLessThan(48);

  // 三列不得撑出横向滚动。
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);

  // 右栏计数与单位上下堆叠，不再挤在一行换行。
  const strong = await page.locator(".coverage-number strong").boundingBox();
  const unit = await page.getByTestId("coverage-unit").boundingBox();
  expect(strong).not.toBeNull();
  expect(unit).not.toBeNull();
  expect(unit!.y).toBeGreaterThan(strong!.y + strong!.height - 2);
});
