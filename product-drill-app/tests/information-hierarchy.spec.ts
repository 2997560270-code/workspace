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
      provenance: read(".sidebar-footer > span")
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
