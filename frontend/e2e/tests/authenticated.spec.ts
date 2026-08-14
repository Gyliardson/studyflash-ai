import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { clerk } from "@clerk/testing/playwright";
import prisma from "../../lib/db.ts";
import { saveFlashcardsForUser } from "../../lib/gamification-transactions.ts";

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

test("collection mutation server predicates are owner-scoped and repeated deletes fail closed", async () => {
  const frontendRoot = resolve(process.cwd(), "..");
  const actionsSource = await readFile(resolve(frontendRoot, "app/actions.ts"), "utf8");
  const saveModalSource = await readFile(resolve(frontendRoot, "app/components/SaveModal.tsx"), "utf8");
  expect(actionsSource).toContain("const normalized = normalizeDeckName(nome);");
  expect(actionsSource).toContain("const normalized = normalizeFlashcards(cards);");
  expect(actionsSource).toContain("saveFlashcardsForUser(userId, normalized.cards, deckId, undefined, normalizedDeckName)");
  expect(actionsSource).toContain("await prisma.deck.delete({ where: { id, userId } });");
  expect(actionsSource).toContain("await prisma.flashcard.delete({ where: { id, userId } });");
  expect(actionsSource).toContain("await prisma.studyPlan.delete({ where: { id, userId } });");
  expect(saveModalSource).toContain("salvarFlashcards(cards, undefined, name)");
  expect(saveModalSource).not.toContain("criarBaralho(");

  const suffix = randomUUID();
  const ownerId = `e2e-owner-${suffix}`;
  const foreignId = `e2e-foreign-${suffix}`;
  const atomicDeckName = `Atomic E2E ${suffix}`;

  const ownerDeck = await prisma.deck.create({ data: { userId: ownerId, nome: `Owner ${suffix}` } });
  const foreignDeck = await prisma.deck.create({ data: { userId: foreignId, nome: `Foreign ${suffix}` } });
  const ownerCard = await prisma.flashcard.create({ data: { userId: ownerId, frente: "Owner?", verso: "Owner!" } });
  const foreignCard = await prisma.flashcard.create({ data: { userId: foreignId, frente: "Foreign?", verso: "Foreign!" } });

  try {
    const atomicCreate = await saveFlashcardsForUser(
      ownerId,
      [{ frente: "Atomic front", verso: "Atomic back" }],
      undefined,
      new Date("2026-08-14T12:00:00Z"),
      atomicDeckName,
    );
    expect(atomicCreate.success).toBe(true);

    const persistedAtomicDeck = await prisma.deck.findFirst({
      where: { userId: ownerId, nome: atomicDeckName },
      include: { cards: true },
    });
    expect(persistedAtomicDeck).not.toBeNull();
    expect(persistedAtomicDeck?.cards).toHaveLength(1);
    expect(persistedAtomicDeck?.cards[0]).toMatchObject({ frente: "Atomic front", verso: "Atomic back", userId: ownerId });

    const xpRowsBeforeDuplicate = await prisma.xPHistory.count({ where: { userId: ownerId, source: "CREATE_CARD" } });
    const duplicateCreate = await saveFlashcardsForUser(
      ownerId,
      [{ frente: "Must not persist", verso: "Must not persist" }],
      undefined,
      new Date("2026-08-14T12:01:00Z"),
      atomicDeckName,
    );
    expect(duplicateCreate).toMatchObject({ success: false, error: "Já existe um grupo com este nome!" });
    expect(await prisma.deck.count({ where: { userId: ownerId, nome: atomicDeckName } })).toBe(1);
    expect(await prisma.flashcard.count({ where: { userId: ownerId, deck: { nome: atomicDeckName } } })).toBe(1);
    expect(await prisma.xPHistory.count({ where: { userId: ownerId, source: "CREATE_CARD" } })).toBe(xpRowsBeforeDuplicate);

    await prisma.deck.delete({ where: { id: ownerDeck.id, userId: ownerId } });
    expect(await prisma.deck.count({ where: { id: ownerDeck.id } })).toBe(0);
    await expect(prisma.deck.delete({ where: { id: ownerDeck.id, userId: ownerId } })).rejects.toThrow();

    await expect(prisma.deck.delete({ where: { id: foreignDeck.id, userId: ownerId } })).rejects.toThrow();
    expect(await prisma.deck.count({ where: { id: foreignDeck.id, userId: foreignId } })).toBe(1);

    await prisma.flashcard.delete({ where: { id: ownerCard.id, userId: ownerId } });
    expect(await prisma.flashcard.count({ where: { id: ownerCard.id } })).toBe(0);
    await expect(prisma.flashcard.delete({ where: { id: ownerCard.id, userId: ownerId } })).rejects.toThrow();

    await expect(prisma.flashcard.delete({ where: { id: foreignCard.id, userId: ownerId } })).rejects.toThrow();
    expect(await prisma.flashcard.count({ where: { id: foreignCard.id, userId: foreignId } })).toBe(1);
  } finally {
    await prisma.flashcard.deleteMany({ where: { userId: { in: [ownerId, foreignId] } } });
    await prisma.deck.deleteMany({ where: { userId: { in: [ownerId, foreignId] } } });
    await prisma.xPHistory.deleteMany({ where: { userId: ownerId } });
    await prisma.userProfile.deleteMany({ where: { userId: ownerId } });
  }
});
