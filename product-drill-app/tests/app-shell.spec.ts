import { expect, test } from "@playwright/test";
import { enterApp } from "./e2e-helpers";

test("navigates between the four direction A modules", async ({ page }) => {
  await enterApp(page);
  const cases = [
    ["02 训练地图 按能力选择训练任务", "训练地图"],
    ["03 复盘与复练 重练具体失误时刻", "复盘与复练"],
    ["04 我的能力 查看掌握状态和证据", "我的能力"],
    ["01 今日训练 开始一次针对性练习", "今天，练会一个真正的产品判断"]
  ] as const;
  for (const [button, heading] of cases) {
    await page.getByRole("button", { name: button, exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  }
});
