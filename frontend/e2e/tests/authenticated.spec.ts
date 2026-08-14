import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { clerk } from "@clerk/testing/playwright";

const TEST_USER_EMAIL =
  process.env.E2E_CLERK_TEST_EMAIL ?? "studyflash.e2e+clerk_test@example.com";

const VALIDATION_MESSAGE =
  "Por favor, cole um texto ou anexe um PDF para começar.";

async function signIn(page: Parameters<typeof clerk.signIn>[0]["page"]) {
  await page.goto("/");
  await clerk.signIn({ page, emailAddress: TEST_USER_EMAIL });
}

async function expectNoBlockingAxeViolations(page: Parameters<typeof clerk.signIn>[0]["page"]) {
  const accessibility = await new AxeBuilder({ page }).analyze();
  const blockingViolations = accessibility.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );

  expect(
    blockingViolations,
    blockingViolations
      .map((violation) => `${violation.id}: ${violation.help}`)
      .join("\n"),
  ).toEqual([]);
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
  await expectNoBlockingAxeViolations(page);
});

test("authenticated exam runs through the real server-authoritative attempt boundary", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/simulado");
  await expect(page).toHaveURL(/\/simulado(?:[/?#]|$)/);

  // Use the no-timer mode so the browser test is deterministic. The fixture has
  // five synthetic cards and the backend falls back locally if the remote AI
  // provider is not configured, so no external LLM is a critical dependency.
  await page.getByRole("button", { name: /Prática/i }).click();
  await page.getByRole("button", { name: /Iniciar Simulado/i }).click();

  await expect(page.getByText(/1\s*\/\s*5/)).toBeVisible({ timeout: 20_000 });

  for (let question = 1; question <= 5; question += 1) {
    const answerButtons = page.locator(".grid.grid-cols-1.gap-3 > button");
    await expect(answerButtons.first()).toBeVisible();
    await answerButtons.first().click();
    if (question < 5) {
      await expect(page.getByText(new RegExp(`${question + 1}\\s*\\/\\s*5`))).toBeVisible();
    }
  }

  await expect(page.getByRole("heading", { name: "Simulado Concluído!" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Acertos", { exact: true })).toBeVisible();
  await expect(page.getByText(/Precisão/i)).toBeVisible();
  await expectNoBlockingAxeViolations(page);
});
