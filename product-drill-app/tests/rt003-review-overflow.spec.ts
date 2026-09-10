import { expect, test, type Page } from "@playwright/test";
import { enterApp } from "./e2e-helpers";

/**
 * RT-003 模拟测试：复盘页「查看上次提交内容」长文本不得把页面撑出横向滚动。
 *
 * 上一轮的修复只给 `.review-submission-block` 内部补了换行规则，复测仍溢出（图2）。
 * 这个用例提交一段超长的不换行文本，然后：
 *   1. 度量 documentElement 的横向溢出；
 *   2. 溢出时列出真正撑宽页面的元素（从 documentElement 逐层向下找），
 *      把排查结论直接写进断言消息，避免再次「无效修复」。
 */

const LONG_UNBREAKABLE = "https://example.com/very/long/path/segment/without/any/break/opportunity/" + "abcdefghij".repeat(8);

async function submitWithLongText(page: Page, viewportWidth: number) {
  await page.setViewportSize({ width: viewportWidth, height: 900 });
  await enterApp(page);
  await page.getByRole("button", { name: "开始 3 分钟诊断", exact: true }).click();
  await page.getByRole("textbox", { name: "你的追问", exact: true }).fill("谁每天使用报表，谁负责最终决策？");
  await page.getByRole("button", { name: "发送追问", exact: true }).click();
  await page.getByRole("button", { name: "结束访谈，整理判断", exact: true }).click();
  await page.getByRole("textbox", { name: "核心问题", exact: true }).fill(LONG_UNBREAKABLE);
  await page.getByRole("textbox", { name: "建议行动", exact: true }).fill(LONG_UNBREAKABLE);
  await page.getByRole("button", { name: "提交判断并查看反馈", exact: true }).click();
  await page.getByRole("heading", { name: "系统为什么做出这个判断" }).waitFor();
  await page.getByRole("button", { name: "完成并返回今日训练", exact: true }).click();
  await page.getByRole("heading", { level: 1, name: "复盘与复练" }).waitFor();
  // 展开「查看上次提交内容（对话与判断画布）」
  await page.getByTestId("review-submission").locator("summary").click();
  await page.getByTestId("review-submission").getByText("提交的判断画布").waitFor();
}

/** 找出真正撑宽页面的元素（从 documentElement 逐层向下） */
async function findOverflowingElements(page: Page) {
  return page.evaluate(() => {
    const docWidth = document.documentElement.clientWidth;
    const offenders: Array<{ selector: string; right: number; scrollWidth: number; width: number }> = [];
    for (const element of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
      const rect = element.getBoundingClientRect();
      const overflowsViewport = rect.right > docWidth + 1;
      const overflowsSelf = element.scrollWidth > element.clientWidth + 1 && element.clientWidth > 0;
      if (!overflowsViewport && !overflowsSelf) continue;
      const parent = element.parentElement;
      const parentRect = parent?.getBoundingClientRect();
      // 只记录「自己比父级还宽」的元素，这些才是真正的溢出源头
      const parentOverflows = parentRect ? parentRect.right > docWidth + 1 : false;
      offenders.push({
        selector: element.className ? `${element.tagName.toLowerCase()}.${String(element.className).split(/\s+/).slice(0, 3).join(".")}` : element.tagName.toLowerCase(),
        right: Math.round(rect.right),
        scrollWidth: element.scrollWidth,
        width: Math.round(rect.width),
        ...(parentOverflows ? {} : { root: 1 })
      } as never);
    }
    return { docWidth, scrollWidth: document.documentElement.scrollWidth, offenders: offenders.slice(-12) };
  });
}

for (const width of [1280, 1024]) {
  test(`RT-003 复盘页长文本在 ${width}px 宽度下不横向溢出`, async ({ page }) => {
    await submitWithLongText(page, width);

    const measured = await findOverflowingElements(page);
    const diagnosis = JSON.stringify(measured, null, 2);

    // 页面整体不应出现横向滚动
    expect(
      measured.scrollWidth,
      `docWidth=${measured.docWidth} 时出现横向溢出，撑宽页面的元素如下：\n${diagnosis}`
    ).toBeLessThanOrEqual(measured.docWidth + 1);

    // 块内文本必须换行（长串不能撑破容器）
    const blockFits = await page.evaluate(() => {
      const blocks = Array.from(document.querySelectorAll<HTMLElement>(".review-submission-block dd, .review-submission-block li p"));
      return blocks.every((block) => block.scrollWidth <= block.clientWidth + 1);
    });
    expect(blockFits, `review-submission-block 内部仍然溢出：\n${diagnosis}`).toBe(true);
  });
}
