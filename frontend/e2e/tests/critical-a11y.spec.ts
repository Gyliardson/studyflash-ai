import AxeBuilder from "@axe-core/playwright";
import { clerk } from "@clerk/testing/playwright";
import { expect, test, type Page } from "@playwright/test";

const TEST_USER_EMAIL = process.env.E2E_CLERK_TEST_EMAIL ?? "studyflash.e2e+clerk_test@example.com";

async function signIn(page: Page) {
  await page.goto("/");
  await clerk.signIn({ page, emailAddress: TEST_USER_EMAIL });
}

async function expectNoBlockingAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter((violation) =>
    violation.impact === "critical" || violation.impact === "serious"
  );
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test("dashboard exposes named generation controls and keyboard-safe save dialog", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard(?:[/?#]|$)/);

  const studyMaterial = page.getByLabel("Conteúdo para gerar flashcards");
  await expect(studyMaterial).toBeVisible();
  await studyMaterial.focus();
  await expect(studyMaterial).toBeFocused();

  await page.route("**/api/ai/gerar", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ cartoes: [{ frente: "Accessibility front", verso: "Accessibility back" }] }),
    });
  });
  await studyMaterial.fill("Conteúdo suficientemente longo para validar os controles acessíveis do dashboard sem chamar um provedor remoto de IA.");
  await page.getByRole("button", { name: /Gerar Flashcards/i }).click();
  await expect(page.getByText("Accessibility front", { exact: true })).toBeVisible();
  const saveButton = page.getByRole("button", { name: "Salvar na minha Coleção" });
  await saveButton.click();

  const dialog = page.getByRole("dialog", { name: "Onde vamos guardar? 🗂️" });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("button", { name: "Fechar diálogo" })).toBeFocused();

  await page.keyboard.press("Shift+Tab");
  expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(saveButton).toBeFocused();

  await expectNoBlockingAxeViolations(page);
});

test("exam configuration uses native keyboard-operable selectors and valid toggles", async ({ page }) => {
  await page.goto("/simulado");
  await expect(page).toHaveURL(/\/simulado(?:[/?#]|$)/);

  const deckSelect = page.getByRole("combobox", { name: "Selecionar baralho" });
  await expect(deckSelect).toBeVisible();
  await expect(deckSelect.locator("option")).toHaveCount(2);
  await deckSelect.focus();
  await expect(deckSelect).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(deckSelect).not.toHaveValue("");

  const practice = page.getByRole("button", { name: /Prática/i });
  await practice.focus();
  await page.keyboard.press("Enter");
  await expect(practice).toHaveAttribute("aria-pressed", "true");

  const volume = page.getByLabel("3. Volume");
  await volume.focus();
  await page.keyboard.press("ArrowRight");
  await expect(volume).toHaveValue("15");

  await expectNoBlockingAxeViolations(page);
});

test("mobile primary navigation exposes state and returns focus on Escape", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "Mobile navigation is only rendered in the mobile project.");

  await page.goto("/dashboard");
  const menuButton = page.getByRole("button", { name: "Abrir menu" });
  await expect(menuButton).toHaveAttribute("aria-expanded", "false");
  await menuButton.click();

  const closeButton = page.getByRole("button", { name: "Fechar menu" });
  await expect(closeButton).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("navigation", { name: "Navegação principal móvel" })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Abrir menu" })).toBeFocused();
  await expect(page.getByRole("navigation", { name: "Navegação principal móvel" })).toHaveCount(0);

  await expectNoBlockingAxeViolations(page);
});
