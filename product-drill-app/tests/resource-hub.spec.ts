import { expect, test } from "@playwright/test";
import { enterApp } from "./e2e-helpers";

// FB-012：标准化考核入口必须在资源中心可见且可用（需求文档第 5 节）。
test("exposes the standardized assessment entry in the resource hub (FB-012)", async ({ page }) => {
  await enterApp(page);
  await page.getByRole("button", { name: "02 训练地图 按能力选择训练任务", exact: true }).click();
  await page.getByRole("button", { name: "打开资源中心", exact: true }).click();

  // 标签页允许换行，「标准化考核」不能被溢出裁掉
  const assessmentTab = page.getByRole("tab", { name: "标准化考核", exact: true });
  await expect(assessmentTab).toBeVisible();
  await assessmentTab.click();
  await expect(assessmentTab).toHaveAttribute("aria-selected", "true");

  // 面板渲染且可启动诊断试点
  await expect(page.getByTestId("assessment-lab")).toBeVisible();
  await page.getByRole("button", { name: "开始标准化试点", exact: true }).click();
  await expect(page.getByText("题序固定，不能跳题或自适应换题。")).toBeVisible();
});
