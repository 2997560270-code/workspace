import { expect, test } from "@playwright/test";
import { enterApp } from "./e2e-helpers";

test("does not expose the old generic product analysis module", async ({ page }) => {
  await enterApp(page);
  await expect(page.getByRole("button", { name: "我的产品", exact: true })).toHaveCount(0);
  await expect(page.getByText("产品发现训练场", { exact: true })).toBeVisible();
});
