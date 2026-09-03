import { expect, test, type Page } from "@playwright/test";
import { reachFeedback } from "./e2e-helpers";

const USER = "e2e-integrity-fb014";
const STORAGE_KEY = `product-drill-direction-a-v1:${USER}`;

async function loginAs(page: Page, userId: string) {
  await page.context().addCookies([{
    name: "product_drill_e2e_user",
    value: userId,
    domain: "127.0.0.1",
    path: "/",
    sameSite: "Lax",
  }]);
  await page.goto("/");
  await page.getByRole("heading", { level: 1, name: "今天，练会一个真正的产品判断" }).waitFor();
  await page.getByText(/产品练习生 · (服务端记录|本地缓存)/).waitFor({ state: "attached" });
}

test("server-signed scores pass integrity checks and tampered scores are marked untrusted (FB-014)", async ({ page }) => {
  await loginAs(page, USER);
  await reachFeedback(page);

  // 复盘页应展示服务端签名校验通过的标记
  await page.getByRole("button", { name: /复盘与复练/ }).click();
  await expect(page.getByTestId("review-integrity-badge")).toBeVisible();
  await expect(page.getByTestId("review-tamper-warning")).toHaveCount(0);

  // 通过开发者工具等价手段篡改本地记录中的评分
  const tamperedScore = await page.evaluate((storageKey) => {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { records: Array<{ totalScore: number }> };
    if (!parsed.records.length) return null;
    const original = parsed.records[0].totalScore;
    parsed.records[0].totalScore = 99;
    window.localStorage.setItem(storageKey, JSON.stringify(parsed));
    return original;
  }, STORAGE_KEY);
  expect(tamperedScore).not.toBeNull();

  // 刷新后：篡改被服务端校验发现，分数标记为不可信
  await page.reload();
  await page.getByRole("button", { name: /复盘与复练/ }).click();
  await expect(page.getByTestId("review-tamper-warning")).toBeVisible();
  await expect(page.getByTestId("review-integrity-badge")).toHaveCount(0);
  await expect(page.locator(".review-metrics strong").first()).toHaveText("不可信");
});
