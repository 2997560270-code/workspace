import { expect, test } from "@playwright/test";
import { enterApp } from "./e2e-helpers";

test("separates claims, evidence, and provenance visually", async ({ page }) => {
  await enterApp(page);

  const styles = await page.evaluate(() => {
    const read = (selector: string) => {
      const element = document.querySelector(selector);
      if (!element) throw new Error(`Missing hierarchy element: ${selector}`);
      const style = getComputedStyle(element);
      return { color: style.color, fontFamily: style.fontFamily };
    };

    return {
      claim: read(".topbar h1"),
      evidence: read(".topbar p"),
      provenance: read(".sidebar-week > span")
    };
  });

  expect(styles.claim).toEqual({
    color: "rgb(21, 26, 34)",
    fontFamily: '"Noto Serif SC", "Source Han Serif SC", "Songti SC", STSongti, STSong, SimSun, NSimSun, serif'
  });
  expect(styles.evidence).toEqual({
    color: "rgb(65, 74, 88)",
    fontFamily: 'Inter, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", system-ui, -apple-system, "Segoe UI", sans-serif'
  });
  expect(styles.provenance).toEqual({
    color: "rgb(123, 130, 144)",
    fontFamily: '"IBM Plex Mono", "JetBrains Mono", "Cascadia Code", "SF Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace'
  });
});

test("keeps claims, evidence, and provenance distinct through the training flow", async ({ page }) => {
  const displayFont = '"Noto Serif SC", "Source Han Serif SC", "Songti SC", STSongti, STSong, SimSun, NSimSun, serif';
  const bodyFont = 'Inter, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", system-ui, -apple-system, "Segoe UI", sans-serif';
  const monoFont = '"IBM Plex Mono", "JetBrains Mono", "Cascadia Code", "SF Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';
  const claim = { color: "rgb(21, 26, 34)", fontFamily: displayFont, fontWeight: "600" };
  const evidence = { color: "rgb(65, 74, 88)", fontFamily: bodyFont, fontWeight: "400" };
  const provenance = { color: "rgb(123, 130, 144)", fontFamily: monoFont, fontWeight: "500" };
  const read = async (selector: string) => page.locator(selector).first().evaluate((element) => {
    const style = getComputedStyle(element);
    return { color: style.color, fontFamily: style.fontFamily, fontWeight: style.fontWeight };
  });
  const readMaxWidth = async (selector: string) => page.locator(selector).first().evaluate((element) => (
    Number.parseFloat(getComputedStyle(element).maxWidth)
  ));

  await enterApp(page);
  await page.getByRole("button", { name: "开始 3 分钟诊断", exact: true }).click();
  await expect(page.locator(".briefing h2")).toBeVisible();

  expect(await read(".briefing h2")).toEqual(claim);
  expect(await read(".briefing > p")).toEqual(evidence);
  expect(await read(".coverage-number span")).toEqual(evidence);
  expect(await read(".training-progress > p")).toEqual(evidence);
  expect(await readMaxWidth(".message p")).toBeGreaterThan(0);

  const input = page.getByRole("textbox", { name: "你的追问", exact: true });
  await input.fill("谁每天使用报表，谁负责最终决策？");
  await page.getByRole("button", { name: "发送追问", exact: true }).click();
  await page.getByRole("button", { name: "结束访谈，整理判断", exact: true }).click();
  await page.getByRole("textbox", { name: "核心问题", exact: true }).fill("真实使用者和失败环节还没有确认");
  await page.getByRole("textbox", { name: "建议行动", exact: true }).fill("暂不直接重写功能，先还原当前流程并验证影响");
  await page.getByRole("button", { name: "提交判断并查看反馈", exact: true }).click();
  await expect(page.getByRole("heading", { name: "系统为什么做出这个判断" })).toBeVisible();

  expect(await read(".feedback-summary h2")).toEqual({ ...claim, color: "rgb(245, 242, 234)" });
  expect(await read(".score-orbit strong")).toEqual({ ...provenance, color: "rgb(141, 150, 166)" });
  expect(await read(".evidence-row blockquote")).toEqual(evidence);
  expect(await read(".evidence-level")).toEqual({ ...provenance, color: "rgb(46, 106, 79)", fontWeight: "600" });
  expect(await read(".retry-copy > strong")).toEqual(claim);

  await page.getByRole("button", { name: "完成并返回今日训练", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "复盘与复练" })).toBeVisible();

  expect(await read(".review-list button span")).toEqual(evidence);
  expect(await read(".review-list button small")).toEqual(claim);
  expect(await read(".review-list button i")).toEqual(provenance);
  expect(await read(".review-metrics strong")).toEqual(provenance);
  expect(await read(".review-evidence article > span")).toEqual({ ...provenance, color: "rgb(176, 67, 47)", fontWeight: "600" });
  expect(await readMaxWidth(".review-evidence blockquote")).toBeGreaterThan(0);
});
