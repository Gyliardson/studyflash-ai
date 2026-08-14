import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { clerk } from "@clerk/testing/playwright";

const TEST_USER_EMAIL =
  process.env.E2E_CLERK_TEST_EMAIL ?? "studyflash.e2e+clerk_test@example.com";

const VALIDATION_MESSAGE =
  "Por favor, cole um texto ou anexe um PDF para começar.";

test("authenticated StudyFlash validation flow uses real Clerk development auth", async ({
  page,
}) => {
  await page.goto("/");
  await clerk.signIn({ page, emailAddress: TEST_USER_EMAIL });

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
  const blockingViolations = accessibility.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );

  expect(
    blockingViolations,
    blockingViolations
      .map((violation) => `${violation.id}: ${violation.help}`)
      .join("\n"),
  ).toEqual([]);
});
