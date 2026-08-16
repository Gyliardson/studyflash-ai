import { clerk } from "@clerk/testing/playwright";
import { expect, test, type Page } from "@playwright/test";

const TEST_USER_EMAIL = process.env.E2E_CLERK_TEST_EMAIL ?? "studyflash.e2e+clerk_test@example.com";

async function signIn(page: Page) {
  await page.goto("/");
  await clerk.signIn({ page, emailAddress: TEST_USER_EMAIL });
}

test("rapid repeated input advances a rendered exam question exactly once", async ({ page }) => {
  await signIn(page);
  await page.goto("/simulado");
  await page.getByRole("button", { name: /Prática/i }).click();
  await page.getByLabel("3. Volume").fill("5");
  await page.getByRole("button", { name: /Iniciar Simulado/i }).click();
  await expect(page.getByText(/1\s*\/\s*5/)).toBeVisible({ timeout: 20_000 });

  const firstOption = page
    .getByRole("group", { name: "Alternativas da questão" })
    .getByRole("button")
    .first();
  await expect(firstOption).toBeVisible();

  await firstOption.evaluate((button) => {
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
  });

  await expect(page.getByText(/2\s*\/\s*5/)).toBeVisible();
  await expect(page.getByText(/3\s*\/\s*5/)).toHaveCount(0);

  for (let question = 2; question <= 5; question += 1) {
    const options = page
      .getByRole("group", { name: "Alternativas da questão" })
      .getByRole("button");
    await expect(options.first()).toBeVisible();
    await options.first().click();
  }

  await expect(page.getByRole("heading", { name: "Simulado Concluído!" })).toBeVisible({ timeout: 20_000 });
});
