import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { clerk } from "@clerk/testing/playwright";
import prisma from "../../lib/db.ts";

const TEST_USER_EMAIL = process.env.E2E_CLERK_TEST_EMAIL ?? "studyflash.e2e+clerk_test@example.com";
const E2E_DECK_NAME = "StudyFlash E2E Exam Fixture";

async function signIn(page: Page) {
  await page.goto("/");
  await clerk.signIn({ page, emailAddress: TEST_USER_EMAIL });
}

async function expectAuthenticatedShell(page: Page) {
  await expect(page.getByRole("navigation", { name: "Navegação principal" })).toBeVisible();
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

test("primary Planos navigation crosses the real route into useful empty and existing-plan states", async ({ page }) => {
  const fixtureOwner = await prisma.deck.findFirstOrThrow({
    where: { nome: E2E_DECK_NAME },
    select: { userId: true },
  });
  const userId = fixtureOwner.userId;
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await prisma.studyPlan.deleteMany({ where: { userId } });
  let planId: string | null = null;

  try {
    await signIn(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/dashboard");

    const desktopNavigation = page.getByRole("navigation", { name: "Navegação principal" });
    await desktopNavigation.getByRole("link", { name: "Planos" }).click();
    await expect(page).toHaveURL(/\/colecao\?tab=planos(?:[&#]|$)/);
    await expect(page.getByRole("tab", { name: "Planos" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("heading", { name: "Nenhum plano de estudo" })).toBeVisible();

    const createPlan = page.getByRole("link", { name: "Criar plano" });
    await expect(createPlan).toBeVisible();
    await createPlan.click();
    await expect(page).toHaveURL(/\/planos\/novo(?:[/?#]|$)/);

    const plan = await prisma.studyPlan.create({
      data: {
        userId,
        title: "Plano E2E Navegação",
        description: "Fixture determinística para a navegação primária de planos.",
        difficulty: "Intermediário",
      },
    });
    planId = plan.id;

    await page.goto("/dashboard");
    await page.getByRole("navigation", { name: "Navegação principal" }).getByRole("link", { name: "Planos" }).click();
    await expect(page).toHaveURL(/\/colecao\?tab=planos(?:[&#]|$)/);
    const planLink = page.getByRole("link", { name: /Plano E2E Navegação/ });
    await expect(planLink).toBeVisible();
    await planLink.click();
    await expect(page).toHaveURL(new RegExp(`/planos/${plan.id}(?:[/?#]|$)`));

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Abrir menu" }).click();
    const mobileNavigation = page.getByRole("navigation", { name: "Navegação principal móvel" });
    await mobileNavigation.getByRole("link", { name: "Planos" }).click();
    await expect(page).toHaveURL(/\/colecao\?tab=planos(?:[&#]|$)/);
    await expect(page.getByRole("tab", { name: "Planos" })).toHaveAttribute("aria-selected", "true");

    expect(pageErrors).toEqual([]);
  } finally {
    if (planId) await prisma.studyPlan.deleteMany({ where: { id: planId } });
  }
});

test("collection plans tab supports direct deep links and browser history", async ({ page }) => {
  await signIn(page);
  await page.goto("/colecao?tab=planos");

  const plansTab = page.getByRole("tab", { name: "Planos" });
  const decksTab = page.getByRole("tab", { name: "Baralhos" });
  await expect(plansTab).toHaveAttribute("aria-selected", "true");

  await decksTab.click();
  await expect(page).toHaveURL(/\/colecao$/);
  await expect(decksTab).toHaveAttribute("aria-selected", "true");

  await page.goBack();
  await expect(page).toHaveURL(/\/colecao\?tab=planos(?:[&#]|$)/);
  await expect(plansTab).toHaveAttribute("aria-selected", "true");

  await page.goForward();
  await expect(page).toHaveURL(/\/colecao$/);
  await expect(decksTab).toHaveAttribute("aria-selected", "true");
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
  await expectAuthenticatedShell(page);
  await attachScreenshot(page, testInfo, "dashboard-desktop-light");

  await page.goto("/configuracoes");
  await expectAuthenticatedShell(page);
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
  await expectAuthenticatedShell(page);
  await expect(page.getByRole("heading").filter({ hasText: /Sessão de estudo|Revisão concluída|Nada para revisar agora/ }).first()).toBeVisible();
  await attachScreenshot(page, testInfo, "study-desktop-light");

  await page.goto("/simulado");
  await expectAuthenticatedShell(page);
  await expect(page.getByRole("heading", { name: "Configuração de Prova" })).toBeVisible();
  await attachScreenshot(page, testInfo, "exam-desktop-light");
});
