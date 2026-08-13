import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("landing page has no axe violations", async ({ page }) => {
  await page.goto("/");
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations).toEqual([]);
});
