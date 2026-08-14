import { randomUUID } from "node:crypto";

import { clerk } from "@clerk/testing/playwright";
import { expect, test } from "@playwright/test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const TEST_USER_EMAIL = process.env.E2E_CLERK_TEST_EMAIL ?? "studyflash.e2e+clerk_test@example.com";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("flashcard save retry converges after server commit response is lost", async ({ page }) => {
  const marker = `idempotent-save-${randomUUID()}`;

  await page.goto("/");
  await clerk.signIn({ page, emailAddress: TEST_USER_EMAIL });
  await page.route("**/api/ai/gerar", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ cartoes: [{ frente: marker, verso: "Persist once" }] }),
    });
  });

  await page.goto("/dashboard");
  await page.getByPlaceholder("Cole seu texto de estudo aqui...").fill("conteúdo determinístico para retry");
  await page.getByRole("button", { name: /Gerar Flashcards/i }).click();
  await expect(page.getByRole("button", { name: /Salvar na minha Coleção/i })).toBeVisible();
  await page.getByRole("button", { name: /Salvar na minha Coleção/i }).click();

  const dialog = page.getByRole("dialog", { name: /Onde vamos guardar/i });
  await expect(dialog).toBeVisible();
  const deckSelect = dialog.getByLabel("Escolha um grupo existente:");
  await expect(deckSelect).toHaveValue(/.+/);
  const deckId = await deckSelect.inputValue();
  const deck = await prisma.deck.findUniqueOrThrow({ where: { id: deckId } });

  const cardsBefore = await prisma.flashcard.count({ where: { deckId } });
  const receiptsBefore = await prisma.mutationReceipt.count({ where: { userId: deck.userId, kind: "SAVE_FLASHCARDS", resultId: deckId } });
  const xpBefore = await prisma.xPHistory.aggregate({
    _sum: { amount: true },
    where: { userId: deck.userId, source: "CREATE_CARD" },
  }).then((result) => result._sum.amount ?? 0);

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

  await dialog.getByRole("button", { name: "Confirmar" }).click();
  await expect(dialog.getByRole("alert")).toContainText("mesmo pedido será recuperado sem duplicar cards ou XP");
  expect(replacedCommittedResponse).toBe(true);

  await dialog.getByRole("button", { name: "Confirmar" }).click();
  await expect(dialog).toHaveCount(0);

  expect(await prisma.flashcard.count({ where: { deckId } })).toBe(cardsBefore + 1);
  expect(await prisma.flashcard.count({ where: { deckId, frente: marker } })).toBe(1);
  expect(await prisma.mutationReceipt.count({ where: { userId: deck.userId, kind: "SAVE_FLASHCARDS", resultId: deckId } })).toBe(receiptsBefore + 1);

  const receipt = await prisma.mutationReceipt.findFirstOrThrow({
    where: { userId: deck.userId, kind: "SAVE_FLASHCARDS", resultId: deckId },
    orderBy: { createdAt: "desc" },
  });
  const xpAfter = await prisma.xPHistory.aggregate({
    _sum: { amount: true },
    where: { userId: deck.userId, source: "CREATE_CARD" },
  }).then((result) => result._sum.amount ?? 0);
  expect(xpAfter - xpBefore).toBe(receipt.xpAwarded);
});
