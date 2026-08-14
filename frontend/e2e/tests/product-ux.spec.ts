import { expect, test, type Page } from "@playwright/test";
import { clerk } from "@clerk/testing/playwright";

const TEST_USER_EMAIL = process.env.E2E_CLERK_TEST_EMAIL ?? "studyflash.e2e+clerk_test@example.com";

async function signIn(page: Page) {
  await page.goto("/");
  await clerk.signIn({ page, emailAddress: TEST_USER_EMAIL });
}

test("authenticated primary navigation exposes the supported product areas", async ({ page }) => {
  await signIn(page);
  await page.goto("/dashboard");

  const navigation = page.getByRole("navigation", { name: "Navegação principal" });
  for (const name of ["Criar", "Coleção", "Planos", "Simulados", "Perfil", "Configurações"]) {
    await expect(navigation.getByRole("link", { name })).toBeVisible();
  }

  await navigation.getByRole("link", { name: "Configurações" }).click();
  await expect(page).toHaveURL(/\/configuracoes(?:[/?#]|$)/);
  await expect(page.getByRole("heading", { name: "Configurações" })).toBeVisible();
});

test("appearance settings change only the supported local theme preference", async ({ page }) => {
  await signIn(page);
  await page.goto("/configuracoes");

  const dark = page.getByRole("button", { name: /Escuro/ });
  await dark.click();
  await expect(dark).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("html")).toHaveClass(/dark/);

  const light = page.getByRole("button", { name: /Claro/ });
  await light.click();
  await expect(light).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("html")).not.toHaveClass(/dark/);
});
