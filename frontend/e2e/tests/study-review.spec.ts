import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { clerk } from "@clerk/testing/playwright";
import prisma from "../../lib/db.ts";

const TEST_USER_EMAIL = process.env.E2E_CLERK_TEST_EMAIL ?? "studyflash.e2e+clerk_test@example.com";
const E2E_DECK_NAME = "StudyFlash E2E Exam Fixture";
const MAX_INT32 = 2_147_483_647;

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

async function syntheticUserId() {
  const fixture = await prisma.deck.findFirstOrThrow({
    where: { nome: E2E_DECK_NAME },
    select: { userId: true },
  });
  return fixture.userId;
}

async function submitEasy(page: Page, projectName: string) {
  const easyButton = page.getByRole("button", { name: /Fácil/i });
  await expect(easyButton).toBeVisible();
  if (projectName.includes("desktop")) {
    await easyButton.focus();
    await expect(easyButton).toBeFocused();
    await page.keyboard.press("Enter");
  } else {
    await easyButton.click();
  }
}

test("failed review stays put, retry commits once, and reload resumes only pending work", async ({ page }, testInfo) => {
  const userId = await syntheticUserId();
  const suffix = randomUUID();
  const firstFront = `Failure-safe first ${suffix}`;
  const secondFront = `Failure-safe second ${suffix}`;
  const originalProfile = await prisma.userProfile.findUnique({ where: { userId } });

  await prisma.studySessionCard.deleteMany({ where: { session: { userId } } });
  await prisma.studySession.deleteMany({ where: { userId } });
  await prisma.xPHistory.deleteMany({ where: { userId, source: "REVIEW" } });

  const deck = await prisma.deck.create({
    data: {
      userId,
      nome: `Failure-safe E2E ${suffix}`,
      cards: {
        create: [
          {
            userId,
            frente: firstFront,
            verso: "First answer",
            nextReview: new Date(Date.now() - 120_000),
          },
          {
            userId,
            frente: secondFront,
            verso: "Second answer",
            nextReview: new Date(Date.now() - 60_000),
          },
        ],
      },
    },
  });

  try {
    await signIn(page);
    await page.goto(`/estudar?deckId=${deck.id}`);
    await expect(page).toHaveURL(new RegExp(`/estudar\\?deckId=${deck.id}`));
    await expect(page.getByText(firstFront, { exact: true })).toBeVisible();
    await expect(page.getByText("1 / 2", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sessão de estudo" })).toBeVisible();
    await expectNoBlockingAxeViolations(page);

    const activeSession = await prisma.studySession.findFirstOrThrow({
      where: { userId, scopeKey: `DECKS:${deck.id}`, status: "ACTIVE" },
    });

    await prisma.userProfile.upsert({
      where: { userId },
      create: { userId, xp: MAX_INT32, weeklyXp: MAX_INT32 },
      update: { xp: MAX_INT32, weeklyXp: MAX_INT32 },
    });

    await submitEasy(page, testInfo.project.name);
    const error = page.getByRole("alert").filter({ hasText: "A revisão ainda não foi confirmada." });
    await expect(error).toContainText("Não foi possível salvar sua revisão. Tente novamente.");
    await expect(page.getByText(firstFront, { exact: true })).toBeVisible();
    await expect(page.getByText("1 / 2", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Revisão concluída" })).toHaveCount(0);
    await expectNoBlockingAxeViolations(page);
    expect(await prisma.xPHistory.count({ where: { userId, source: "REVIEW" } })).toBe(0);
    expect(await prisma.studySessionCard.count({
      where: { sessionId: activeSession.id, status: "PENDING" },
    })).toBe(2);

    await prisma.userProfile.update({
      where: { userId },
      data: { xp: 0, weeklyXp: 0 },
    });
    const retryButton = page.getByRole("button", { name: "Reenviar esta avaliação" });
    await retryButton.focus();
    await expect(retryButton).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(page.getByText(secondFront, { exact: true })).toBeVisible();
    await expect(page.getByText("2 / 2", { exact: true })).toBeVisible();
    expect(await prisma.xPHistory.count({ where: { userId, source: "REVIEW" } })).toBe(1);
    expect(await prisma.studySessionCard.count({
      where: { sessionId: activeSession.id, status: "COMMITTED" },
    })).toBe(1);

    await page.reload();
    await expect(page.getByText(secondFront, { exact: true })).toBeVisible();
    await expect(page.getByText(firstFront, { exact: true })).toHaveCount(0);
    await expect(page.getByText("1 / 1", { exact: true })).toBeVisible();
    expect(await prisma.xPHistory.count({ where: { userId, source: "REVIEW" } })).toBe(1);

    await submitEasy(page, testInfo.project.name);
    await expect(page.getByRole("heading", { name: "Revisão concluída" })).toBeVisible();
    await expect(page.getByText(/Todas as avaliações desta fila foram confirmadas pelo servidor/i)).toBeVisible();
    await expectNoBlockingAxeViolations(page);
    expect(await prisma.xPHistory.count({ where: { userId, source: "REVIEW" } })).toBe(2);

    await page.reload();
    await expect(page.getByRole("heading", { name: "Revisão concluída" })).toBeVisible();
    await expect(page.getByText(firstFront, { exact: true })).toHaveCount(0);
    await expect(page.getByText(secondFront, { exact: true })).toHaveCount(0);
    expect(await prisma.xPHistory.count({ where: { userId, source: "REVIEW" } })).toBe(2);
  } finally {
    await prisma.studySessionCard.deleteMany({ where: { session: { userId } } });
    await prisma.studySession.deleteMany({ where: { userId } });
    await prisma.flashcard.deleteMany({ where: { deckId: deck.id, userId } });
    await prisma.deck.deleteMany({ where: { id: deck.id, userId } });
    await prisma.xPHistory.deleteMany({ where: { userId, source: "REVIEW" } });

    if (originalProfile) {
      await prisma.userProfile.upsert({
        where: { userId },
        create: {
          userId,
          xp: originalProfile.xp,
          level: originalProfile.level,
          weeklyXp: originalProfile.weeklyXp,
          currentStreak: originalProfile.currentStreak,
          longestStreak: originalProfile.longestStreak,
          lastStudyDate: originalProfile.lastStudyDate,
        },
        update: {
          xp: originalProfile.xp,
          level: originalProfile.level,
          weeklyXp: originalProfile.weeklyXp,
          currentStreak: originalProfile.currentStreak,
          longestStreak: originalProfile.longestStreak,
          lastStudyDate: originalProfile.lastStudyDate,
        },
      });
    } else {
      await prisma.userProfile.deleteMany({ where: { userId } });
    }
  }
});
