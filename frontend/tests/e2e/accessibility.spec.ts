import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("landing page accessibility scan", async ({ page }) => {
  await page.goto("/");
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations).toEqual([]);
});
