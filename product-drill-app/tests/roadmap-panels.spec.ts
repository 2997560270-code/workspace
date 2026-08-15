import { expect, test } from "@playwright/test";
import { enterApp } from "./e2e-helpers";

async function openResourceHub(page: Parameters<typeof enterApp>[0]) {
  await enterApp(page);
  await page.getByRole("button", { name: "02 训练地图 按能力选择训练任务", exact: true }).click();
  await page.getByRole("button", { name: "打开资源中心", exact: true }).click();
}

test("runs the local anonymous community review beta flow", async ({ page }) => {
  await openResourceHub(page);
  await page.getByRole("tab", { name: "社区盲评 Beta", exact: true }).click();
  await expect(page.getByTestId("community-review-beta")).toContainText("匿名派题与分歧保留");
  await page.getByRole("button", { name: "准备本地锚例", exact: true }).click();
  await page.getByRole("button", { name: "随机领取评审", exact: true }).click();
  await page.getByLabel("社区盲评理由").fill("引用匿名决策事件中的具体证据，并说明当前判断仍存在的不确定性。");
  await page.getByRole("button", { name: "提交原始盲评", exact: true }).click();
  await expect(page.getByTestId("community-review-beta")).toContainText("需要复审");
});

test("runs the fixed-order standardized assessment pilot", async ({ page }) => {
  await openResourceHub(page);
  await page.getByRole("tab", { name: "标准化考核", exact: true }).click();
  await page.getByRole("button", { name: "开始标准化试点", exact: true }).click();
  for (const answer of ["先确认真实证据和不确定性。", "在约束下完成工作样本并说明取舍。", "独立回答锚题并保留验证边界。"] ) {
    await page.getByLabel("标准化考核回答").fill(answer);
    await page.getByRole("button", { name: "提交当前回答", exact: true }).click();
  }
  await expect(page.getByTestId("assessment-lab")).toContainText("诊断性报告");
});

test("requires manual review before the verified pilot report", async ({ page }) => {
  await openResourceHub(page);
  await page.getByRole("tab", { name: "受验证试点", exact: true }).click();
  await page.getByRole("button", { name: "开始本地试点演示", exact: true }).click();
  await page.getByRole("button", { name: "完成人工身份核验", exact: true }).click();
  await page.getByRole("button", { name: "记录环境声明", exact: true }).click();
  await page.getByRole("button", { name: "结束场次并排队复核", exact: true }).click();
  await page.getByRole("button", { name: "人工复核通过", exact: true }).click();
  await expect(page.getByTestId("verified-pilot")).toContainText("pilot_only");
});
