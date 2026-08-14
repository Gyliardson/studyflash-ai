import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { clerk } from "@clerk/testing/playwright";
import { expect, test, type Page } from "@playwright/test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const TEST_USER_EMAIL = process.env.E2E_CLERK_TEST_EMAIL ?? "studyflash.e2e+clerk_test@example.com";
const VALIDATION_MESSAGE = "Por favor, cole um texto ou anexe um PDF para começar.";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

test.afterAll(async () => {
  await prisma.$disconnect();
});

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

function appAlert(page: Page, message: string) {
  return page.getByRole("alert").filter({ hasText: message });
}

test("authenticated StudyFlash validation flow uses real Clerk development auth", async ({ page }) => {
  await signIn(page);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard(?:[/?#]|$)/);
  const aiRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/ai/gerar")) aiRequests.push(request.url());
  });
  const generateButton = page.getByRole("button", { name: /Gerar Flashcards/i });
  await generateButton.focus();
  await expect(generateButton).toBeFocused();
  await generateButton.click();
  await expect(page.getByText(VALIDATION_MESSAGE, { exact: true })).toBeVisible();
  expect(aiRequests).toEqual([]);
  await expectNoBlockingAxeViolations(page);
});

test("collection UI follows authoritative create, validation and destructive confirmation results", async ({ page }, testInfo) => {
  const suffix = `${testInfo.retry}-${randomUUID()}`;
  const name = `E2E Mutation Deck ${suffix}`;
  const cardFront = `Delete confirmation ${suffix}`;
  let deckId: string | null = null;

  await signIn(page);
  await page.goto("/colecao");
  await expect(page).toHaveURL(/\/colecao(?:[/?#]|$)/);

  try {
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
    await expectNoBlockingAxeViolations(page);

    const deck = await prisma.deck.findFirstOrThrow({ where: { nome: name }, orderBy: { createdAt: "desc" } });
    deckId = deck.id;
    const card = await prisma.flashcard.create({
      data: { userId: deck.userId, deckId: deck.id, frente: cardFront, verso: "Persisted until explicit confirmation" },
    });

    await page.goto(`/colecao/${deck.id}`);
    await expect(page.getByText(cardFront, { exact: true })).toBeVisible();
    const flipButton = page.getByRole("button", { name: "Cartão 1: mostrar resposta" });
    await flipButton.focus();
    await expect(flipButton).toBeFocused();
    await flipButton.press("Enter");
    await expect(page.getByRole("button", { name: "Cartão 1: mostrar pergunta" })).toHaveAttribute("aria-pressed", "true");
    await expectNoBlockingAxeViolations(page);

    await page.getByRole("button", { name: "Excluir cartão 1" }).click();
    const cardDialog = page.getByRole("alertdialog", { name: "Excluir cartão?" });
    await expect(cardDialog).toBeVisible();
    await expect(page.getByText(cardFront, { exact: true })).toBeVisible();
    await cardDialog.getByRole("button", { name: "Excluir cartão" }).click();
    await expect(page.getByText(cardFront, { exact: true })).toHaveCount(0);
    expect(await prisma.flashcard.count({ where: { id: card.id } })).toBe(0);

    await page.goto("/colecao");
    const deleteButton = page.getByRole("button", { name: `Excluir baralho ${name}` });
    await deleteButton.click();
    const deleteDialog = page.getByRole("alertdialog", { name: "Excluir baralho?" });
    await expect(deleteDialog).toBeVisible();
    await deleteDialog.getByRole("button", { name: "Excluir" }).click();
    await expect(page.getByText(name, { exact: true })).toHaveCount(0);
  } finally {
    if (deckId) {
      await prisma.flashcard.deleteMany({ where: { deckId } });
      await prisma.deck.deleteMany({ where: { id: deckId } });
    }
  }
});

test("invalid generated cards are rejected by the real save Server Action without partial state", async ({ page }, testInfo) => {
  const suffix = `${testInfo.retry}-${randomUUID()}`;
  const marker = `invalid-card-marker-${suffix}`;
  await signIn(page);
  await page.route("**/api/ai/gerar", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ cartoes: [{ frente: "   ", verso: marker }] }) });
  });
  await page.goto("/dashboard");
  await page.getByPlaceholder("Cole seu texto de estudo aqui...").fill("conteúdo determinístico de teste");
  await page.getByRole("button", { name: /Gerar Flashcards/i }).click();
  await expect(page.getByRole("button", { name: /Salvar na minha Coleção/i })).toBeVisible();
  await page.getByRole("button", { name: /Salvar na minha Coleção/i }).click();
  const dialog = page.getByRole("dialog", { name: /Onde vamos guardar/i });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Escolha um grupo existente:")).toHaveValue(/.+/);
  await dialog.getByRole("button", { name: "Confirmar" }).click();
  await expect(appAlert(page, "Frente e verso do flashcard são obrigatórios.")).toContainText("Frente e verso do flashcard são obrigatórios.");
  await expect(dialog).toBeVisible();
  expect(await prisma.flashcard.count({ where: { verso: marker } })).toBe(0);
});

test("collection mutation server predicates are owner-scoped and repeated deletes fail closed", async () => {
  const frontendRoot = resolve(process.cwd(), "..");
  const actionsSource = await readFile(resolve(frontendRoot, "app/actions.ts"), "utf8");
  const idempotentActionsSource = await readFile(resolve(frontendRoot, "app/idempotent-actions.ts"), "utf8");
  const saveModalSource = await readFile(resolve(frontendRoot, "app/components/SaveModal.tsx"), "utf8");
  const deckDetailSource = await readFile(resolve(frontendRoot, "app/(platform)/colecao/[deckId]/page.tsx"), "utf8");
  expect(actionsSource).toContain("const normalized = normalizeDeckName(nome);");
  expect(actionsSource).toContain("const normalized = normalizeFlashcards(cards);");
  expect(actionsSource).toContain("saveFlashcardsForUser(userId, normalized.cards, deckId, undefined, normalizedDeckName)");
  expect(actionsSource).toContain("await prisma.deck.delete({ where: { id, userId } });");
  expect(actionsSource).toContain("await prisma.flashcard.delete({ where: { id, userId } });");
  expect(actionsSource).toContain("await prisma.studyPlan.delete({ where: { id, userId } });");
  expect(idempotentActionsSource).toContain("saveFlashcardsIdempotentForUser(userId, normalizedCards.cards, deckId, normalizedDeckName, requestKey)");
  expect(saveModalSource).toContain("salvarFlashcardsIdempotente(cards, undefined, name, currentRequestKey())");
  expect(saveModalSource).toContain("requestKeyRef.current");
  expect(saveModalSource).not.toContain("criarBaralho(");
  expect(deckDetailSource).toContain("<ConfirmDialog");
  expect(deckDetailSource).not.toContain("confirm(");

  const suffix = randomUUID();
  const ownerId = `e2e-owner-${suffix}`;
  const foreignId = `e2e-foreign-${suffix}`;
  const ownerDeck = await prisma.deck.create({ data: { userId: ownerId, nome: `Owner ${suffix}` } });
  const foreignDeck = await prisma.deck.create({ data: { userId: foreignId, nome: `Foreign ${suffix}` } });
  const ownerCard = await prisma.flashcard.create({ data: { userId: ownerId, deckId: ownerDeck.id, frente: "Owner", verso: "Card" } });
  const foreignCard = await prisma.flashcard.create({ data: { userId: foreignId, deckId: foreignDeck.id, frente: "Foreign", verso: "Card" } });
  const ownerPlan = await prisma.studyPlan.create({ data: { userId: ownerId, title: `Owner ${suffix}`, description: "test", difficulty: "EASY" } });
  const foreignPlan = await prisma.studyPlan.create({ data: { userId: foreignId, title: `Foreign ${suffix}`, description: "test", difficulty: "EASY" } });

  try {
    await expect(prisma.flashcard.delete({ where: { id: foreignCard.id, userId: ownerId } })).rejects.toThrow();
    expect(await prisma.flashcard.count({ where: { id: foreignCard.id, userId: foreignId } })).toBe(1);
    await prisma.flashcard.delete({ where: { id: ownerCard.id, userId: ownerId } });
    expect(await prisma.flashcard.count({ where: { id: ownerCard.id } })).toBe(0);
    await expect(prisma.flashcard.delete({ where: { id: ownerCard.id, userId: ownerId } })).rejects.toThrow();

    await expect(prisma.studyPlan.delete({ where: { id: foreignPlan.id, userId: ownerId } })).rejects.toThrow();
    expect(await prisma.studyPlan.count({ where: { id: foreignPlan.id, userId: foreignId } })).toBe(1);
    await prisma.studyPlan.delete({ where: { id: ownerPlan.id, userId: ownerId } });
    expect(await prisma.studyPlan.count({ where: { id: ownerPlan.id } })).toBe(0);
    await expect(prisma.studyPlan.delete({ where: { id: ownerPlan.id, userId: ownerId } })).rejects.toThrow();

    await expect(prisma.deck.delete({ where: { id: foreignDeck.id, userId: ownerId } })).rejects.toThrow();
    expect(await prisma.deck.count({ where: { id: foreignDeck.id, userId: foreignId } })).toBe(1);
    await prisma.deck.delete({ where: { id: ownerDeck.id, userId: ownerId } });
    expect(await prisma.deck.count({ where: { id: ownerDeck.id } })).toBe(0);
    await expect(prisma.deck.delete({ where: { id: ownerDeck.id, userId: ownerId } })).rejects.toThrow();
  } finally {
    await prisma.studyPlan.deleteMany({ where: { userId: { in: [ownerId, foreignId] } } });
    await prisma.flashcard.deleteMany({ where: { userId: { in: [ownerId, foreignId] } } });
    await prisma.deck.deleteMany({ where: { userId: { in: [ownerId, foreignId] } } });
    await prisma.userProfile.deleteMany({ where: { userId: { in: [ownerId, foreignId] } } });
  }
});

test("authenticated exam runs through the real server-authoritative attempt boundary", async ({ page }) => {
  await signIn(page);
  await page.goto("/simulado");
  await page.getByRole("button", { name: /Prática/i }).click();
  await page.getByLabel("3. Volume").fill("5");
  await page.getByRole("button", { name: /Iniciar Simulado/i }).click();
  await expect(page.getByText(/1\s*\/\s*5/)).toBeVisible({ timeout: 20_000 });
  for (let question = 1; question <= 5; question += 1) {
    const answers = page.getByRole("group", { name: "Alternativas da questão" }).getByRole("button");
    await expect(answers.first()).toBeVisible();
    await answers.first().click();
  }
  await expect(page.getByRole("heading", { name: "Simulado Concluído!" })).toBeVisible({ timeout: 20_000 });
});

test("exam recovery converges when the committed finalization response is lost", async ({ page }) => {
  const sessionsBefore = await prisma.examSession.count();
  const examXpBefore = await prisma.xPHistory.count({ where: { source: "EXAM" } });

  await signIn(page);
  await page.goto("/simulado");
  await page.getByRole("button", { name: /Prática/i }).click();
  await page.getByLabel("3. Volume").fill("5");
  await page.getByRole("button", { name: /Iniciar Simulado/i }).click();
  await expect(page.getByText(/1\s*\/\s*5/)).toBeVisible({ timeout: 20_000 });

  let replacedCommittedResponse = false;
  await page.route("**/*", async (route) => {
    const request = route.request();
    if (!replacedCommittedResponse && request.method() === "POST" && request.headers()["next-action"]) {
      const response = await route.fetch();
      expect(response.ok()).toBe(true);
      replacedCommittedResponse = true;
      await route.fulfill({
        status: 503,
        contentType: "text/plain",
        body: "Simulated gateway failure after upstream commit",
      });
      return;
    }
    await route.continue();
  });

  for (let question = 1; question <= 5; question += 1) {
    const options = page.getByRole("group", { name: "Alternativas da questão" }).getByRole("button");
    await expect(options.first()).toBeVisible();
    await options.first().click();
  }

  await expect(page.getByRole("heading", { name: "Suas respostas foram preservadas" })).toBeVisible({ timeout: 20_000 });
  expect(replacedCommittedResponse).toBe(true);

  await page.getByRole("button", { name: "Tentar salvar novamente" }).click();
  await expect(page.getByRole("heading", { name: "Simulado Concluído!" })).toBeVisible({ timeout: 20_000 });

  expect(await prisma.examSession.count()).toBe(sessionsBefore + 1);
  expect(await prisma.xPHistory.count({ where: { source: "EXAM" } })).toBe(examXpBefore + 1);
  await expectNoBlockingAxeViolations(page);
});
