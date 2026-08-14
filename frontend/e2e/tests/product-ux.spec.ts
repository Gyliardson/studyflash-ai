import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { clerk } from "@clerk/testing/playwright";

const TEST_USER_EMAIL = process.env.E2E_CLERK_TEST_EMAIL ?? "studyflash.e2e+clerk_test@example.com";

async function signIn(page: Page) {
  await page.goto("/");
  await clerk.signIn({ page, emailAddress: TEST_USER_EMAIL });
}

async function attachScreenshot(page: Page, testInfo: TestInfo, name: string) {
  await testInfo.attach(name, {
    body: await page.screenshot({ fullPage: true, animations: "disabled" }),
    contentType: "image/png",
  });
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

test("portfolio evidence captures representative responsive light and dark product surfaces", async ({ page }, testInfo) => {
  await signIn(page);

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/dashboard");
  await expect(page.getByRole("navigation", { name: "Navegação principal" })).toBeVisible();
  await attachScreenshot(page, testInfo, "dashboard-desktop-light");

  await page.goto("/configuracoes");
  const dark = page.getByRole("button", { name: /Escuro/ });
  await dark.click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await attachScreenshot(page, testInfo, "settings-desktop-dark");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/colecao");
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await expect(page.getByRole("navigation", { name: "Navegação principal móvel" })).toBeVisible();
  await attachScreenshot(page, testInfo, "collection-mobile-dark");

  await page.goto("/configuracoes");
  await page.getByRole("button", { name: /Claro/ }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.goto("/perfil");
  await attachScreenshot(page, testInfo, "profile-mobile-light");

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/estudar");
  await expect(page.getByRole("heading").filter({ hasText: /Sessão de estudo|Revisão concluída|Nada para revisar agora/ }).first()).toBeVisible();
  await attachScreenshot(page, testInfo, "study-desktop-light");

  await page.goto("/simulado");
  await expect(page.getByRole("heading", { name: "Configuração de Prova" })).toBeVisible();
  await attachScreenshot(page, testInfo, "exam-desktop-light");
});
