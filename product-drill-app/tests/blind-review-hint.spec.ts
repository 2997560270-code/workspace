import { expect, test } from "@playwright/test";
import { enterApp, gotoView } from "./e2e-helpers";

/**
 * FB-010：盲评理由要求至少 20 字，但之前只有 placeholder、没有实时提示。
 * 这里验证两处盲评入口都会给出「还差 N 个字」的实时反馈。
 */

async function openResourceTab(page: import("@playwright/test").Page, tab: string) {
  await gotoView(page, "map");
  await page.getByRole("button", { name: "打开资源中心", exact: true }).click();
  await page.getByRole("tab", { name: tab, exact: true }).click();
}

test("validation lab shows a live countdown for the blind-review reason (FB-010)", async ({ page }) => {
  await enterApp(page);
  await openResourceTab(page, "验证实验室");

  // 先创建邀请制批次，盲评任务才会出现
  await page.getByLabel("验证批次名称").fill("封闭试验 01");
  await page.getByRole("button", { name: "创建邀请制批次", exact: true }).click();

  const reason = page.getByLabel("盲评理由");
  const submit = page.getByRole("button", { name: "提交独立盲评", exact: true });
  const hint = page.getByTestId("blind-review-hint");

  await reason.fill("这是判断理由");
  await expect(submit).toBeDisabled();
  await expect(hint).toContainText("还差");

  await reason.fill("这是判断理由，说明了证据和不确定性，已经超过二十个字了。");
  await expect(hint).toHaveCount(0);
  await expect(submit).toBeEnabled();
});

test("community blind review shows the same live countdown (FB-010)", async ({ page }) => {
  await enterApp(page);
  await openResourceTab(page, "社区盲评 Beta");

  await page.getByRole("button", { name: "随机领取评审", exact: true }).click();

  const reason = page.getByLabel("社区盲评理由");
  const submit = page.getByRole("button", { name: "提交原始盲评", exact: true });
  const hint = page.getByTestId("community-blind-review-hint");

  await reason.fill("理由不够长");
  await expect(submit).toBeDisabled();
  await expect(hint).toContainText("还差");

  await reason.fill("这是社区盲评理由，说明了证据和理由，也说明不确定性，长度足够。");
  await expect(hint).toHaveCount(0);
  await expect(submit).toBeEnabled();
});
