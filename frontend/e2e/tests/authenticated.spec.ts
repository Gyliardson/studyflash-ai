import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { clerk } from "@clerk/testing/playwright";

const TEST_USER_EMAIL =
  process.env.E2E_CLERK_TEST_EMAIL ?? "studyflash.e2e+clerk_test@example.com";

const VALIDATION_MESSAGE =
  "Por favor, cole um texto ou anexe um PDF para começar.";

async function signIn(page: Page) {
  await page.goto("/");
  await clerk.signIn({ page, emailAddress: TEST_USER_EMAIL });
}

function blockingAxeViolations(results: Awaited<ReturnType<AxeBuilder["analyze"]>>) {
  return results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
}

function appAlert(page: Page, text: string) {
  return page.locator('[role="alert"]').filter({ hasText: text });
}

test("authenticated StudyFlash validation flow uses real Clerk development auth", async ({
  page,
}) => {
  await signIn(page);

  const aiRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/ai/gerar")) aiRequests.push(request.url());
  });

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard(?:[/?#]|$)/);

  const generateButton = page.getByRole("button", { name: /Gerar Flashcards/i });
  await expect(generateButton).toBeVisible();
  await generateButton.focus();
  await expect(generateButton).toBeFocused();
  await generateButton.click();

  await expect(page.getByText(VALIDATION_MESSAGE, { exact: true })).toBeVisible();
  expect(aiRequests).toEqual([]);

  const accessibility = await new AxeBuilder({ page }).analyze();
  const blockingViolations = blockingAxeViolations(accessibility);
  expect(
    blockingViolations,
    blockingViolations.map((violation) => `${violation.id}: ${violation.help}`).join("\n"),
  ).toEqual([]);
});

test("collection UI follows authoritative create, validation and delete results", async ({ page }, testInfo) => {
  await signIn(page);
  await page.goto("/colecao");
  await expect(page).toHaveURL(/\/colecao(?:[/?#]|$)/);

  const name = `E2E Mutation Deck ${testInfo.retry}`;
  const input = page.getByLabel("Nome do novo baralho");
  const createButton = page.getByRole("button", { name: "Criar" });

  await input.fill(name);
  await createButton.click();
  await expect(page.getByText(name, { exact: true })).toBeVisible();

  await input.fill(name);
  await createButton.click();
  await expect(appAlert(page, "Já existe um grupo com este nome!")).toContainText("Já existe um grupo com este nome!");
  await expect(page.getByText(name, { exact: true })).toBeVisible();

  await input.fill("x".repeat(81));
  await createButton.click();
  await expect(appAlert(page, "no máximo 80 caracteres")).toContainText("no máximo 80 caracteres");
  await expect(page.getByText(name, { exact: true })).toBeVisible();

  const accessibility = await new AxeBuilder({ page }).analyze();
  const blockingViolations = blockingAxeViolations(accessibility);
  expect(
    blockingViolations,
    blockingViolations.map((violation) => `${violation.id}: ${violation.help}`).join("\n"),
  ).toEqual([]);

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: `Excluir baralho ${name}` }).click();
  await expect(page.getByText(name, { exact: true })).toHaveCount(0);
});
