import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("landing page has no axe violations", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.ok()).toBeTruthy();
  await expect(page).toHaveTitle(/StudyFlash/i);

  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations).toEqual([]);
});
