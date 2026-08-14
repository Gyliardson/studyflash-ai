import test, { after, beforeEach } from "node:test";
import assert from "node:assert/strict";

import prisma from "../lib/db.ts";
import { XP_VALUES } from "../lib/gamification.ts";
import {
  recordStudySessionReviewForUser,
  startOrResumeStudySessionForUser,
} from "../lib/study-session-transactions.mjs";

const userA = "study-session-user-a";
const userB = "study-session-user-b";
const now = new Date("2026-08-14T12:00:00.000Z");

async function resetDatabase() {
  await prisma.studySessionCard.deleteMany();
  await prisma.studySession.deleteMany();
  await prisma.examQuestion.deleteMany();
  await prisma.examSession.deleteMany();
  await prisma.examAttemptQuestion.deleteMany();
  await prisma.examAttempt.deleteMany();
  await prisma.flashcard.deleteMany();
  await prisma.topic.deleteMany();
  await prisma.studyPlan.deleteMany();
  await prisma.deck.deleteMany();
  await prisma.xPHistory.deleteMany();
  await prisma.userReward.deleteMany();
  await prisma.reward.deleteMany();
  await prisma.userProfile.deleteMany();
}

beforeEach(resetDatabase);

after(async () => {
  await resetDatabase();
  await prisma.$disconnect();
});

function createCard(userId = userA, overrides = {}) {
  return prisma.flashcard.create({
    data: {
      userId,
      frente: "Question",
      verso: "Answer",
      nextReview: new Date(now.getTime() - 60_000),
      ...overrides,
    },
  });
}

test("reload resumes the same active queue instead of inventing browser progress", async () => {
  const firstCard = await createCard(userA, { frente: "First" });
  const secondCard = await createCard(userA, { frente: "Second", nextReview: new Date(now.getTime() - 30_000) });

  const started = await startOrResumeStudySessionForUser(userA, {}, now);
  const resumed = await startOrResumeStudySessionForUser(userA, {}, new Date(now.getTime() + 5_000));

  assert.equal(started.success, true);
  assert.equal(resumed.success, true);
  assert.equal(resumed.resumed, true);
  assert.equal(resumed.sessionId, started.sessionId);
  assert.deepEqual(resumed.cards.map((card) => card.id), [firstCard.id, secondCard.id]);
  assert.equal(await prisma.studySession.count({ where: { userId: userA, status: "ACTIVE" } }), 1);
});

test("a committed review disappears from resume and is never acknowledged before persistence", async () => {
  const firstCard = await createCard(userA, { frente: "First" });
  const secondCard = await createCard(userA, { frente: "Second", nextReview: new Date(now.getTime() - 30_000) });
  const session = await startOrResumeStudySessionForUser(userA, {}, now);

  const committed = await recordStudySessionReviewForUser(userA, session.sessionId, firstCard.id, "facil", now);
  assert.equal(committed.success, true);

  const resumed = await startOrResumeStudySessionForUser(userA, {}, new Date(now.getTime() + 1_000));
  assert.equal(resumed.sessionId, session.sessionId);
  assert.deepEqual(resumed.cards.map((card) => card.id), [secondCard.id]);
  assert.equal(await prisma.studySessionCard.count({
    where: { sessionId: session.sessionId, flashcardId: firstCard.id, status: "COMMITTED" },
  }), 1);
  const persisted = await prisma.flashcard.findUniqueOrThrow({ where: { id: firstCard.id } });
  assert.ok(persisted.nextReview > now);
});

test("same session item is idempotent across sequential retry and cannot duplicate XP", async () => {
  const card = await createCard();
  const session = await startOrResumeStudySessionForUser(userA, {}, now);
  const first = await recordStudySessionReviewForUser(userA, session.sessionId, card.id, "facil", now);
  const nextReviewAfterFirst = (await prisma.flashcard.findUniqueOrThrow({ where: { id: card.id } })).nextReview;
  const retry = await recordStudySessionReviewForUser(userA, session.sessionId, card.id, "errei", new Date(now.getTime() + 10_000));

  assert.equal(first.success, true);
  assert.equal(first.replayed, false);
  assert.equal(retry.success, true);
  assert.equal(retry.replayed, true);
  assert.equal(retry.xpGained, first.xpGained);
  assert.equal(await prisma.xPHistory.count({ where: { userId: userA, source: "REVIEW" } }), 1);
  assert.equal((await prisma.flashcard.findUniqueOrThrow({ where: { id: card.id } })).nextReview.getTime(), nextReviewAfterFirst.getTime());
});

test("concurrent double submit commits one SRS/XP mutation and both callers converge on success", async () => {
  const card = await createCard();
  const session = await startOrResumeStudySessionForUser(userA, {}, now);
  const results = await Promise.all([
    recordStudySessionReviewForUser(userA, session.sessionId, card.id, "dificil", now),
    recordStudySessionReviewForUser(userA, session.sessionId, card.id, "dificil", now),
  ]);

  assert.equal(results.filter((result) => result.success).length, 2);
  assert.equal(results.filter((result) => result.replayed).length, 1);
  assert.equal(await prisma.xPHistory.count({ where: { userId: userA, source: "REVIEW" } }), 1);
  const profile = await prisma.userProfile.findUniqueOrThrow({ where: { userId: userA } });
  assert.equal(profile.xp, XP_VALUES.REVIEW_HARD);
  assert.equal(await prisma.studySessionCard.count({ where: { sessionId: session.sessionId, status: "COMMITTED" } }), 1);
});

test("cross-user session access fails closed without mutating card or XP", async () => {
  const card = await createCard(userA);
  const session = await startOrResumeStudySessionForUser(userA, {}, now);
  const before = await prisma.flashcard.findUniqueOrThrow({ where: { id: card.id } });

  const foreign = await recordStudySessionReviewForUser(userB, session.sessionId, card.id, "facil", now);
  assert.equal(foreign.success, false);
  assert.equal(await prisma.xPHistory.count({ where: { userId: userB } }), 0);
  const afterCard = await prisma.flashcard.findUniqueOrThrow({ where: { id: card.id } });
  assert.equal(afterCard.nextReview.getTime(), before.nextReview.getTime());
});

test("transaction failure rolls back session claim, SRS, XP and streak so retry remains truthful", async () => {
  const card = await createCard();
  const session = await startOrResumeStudySessionForUser(userA, {}, now);
  const dueAt = card.nextReview;
  await prisma.userProfile.create({
    data: {
      userId: userA,
      xp: 2_147_483_647,
      weeklyXp: 2_147_483_647,
      currentStreak: 3,
      longestStreak: 3,
      lastStudyDate: new Date(now.getTime() - 86_400_000),
    },
  });

  await assert.rejects(() => recordStudySessionReviewForUser(userA, session.sessionId, card.id, "facil", now));

  const item = await prisma.studySessionCard.findFirstOrThrow({ where: { sessionId: session.sessionId, flashcardId: card.id } });
  assert.equal(item.status, "PENDING");
  assert.equal(item.committedAt, null);
  const unchanged = await prisma.flashcard.findUniqueOrThrow({ where: { id: card.id } });
  assert.equal(unchanged.nextReview.getTime(), dueAt.getTime());
  assert.equal(await prisma.xPHistory.count({ where: { userId: userA } }), 0);
  assert.equal((await prisma.studySession.findUniqueOrThrow({ where: { id: session.sessionId } })).status, "ACTIVE");
});

test("reload during extra study resumes the extra queue instead of resurrecting a due-only session", async () => {
  const future = await createCard(userA, { nextReview: new Date(now.getTime() + 86_400_000) });
  const extra = await startOrResumeStudySessionForUser(userA, { modeExtra: true }, now);
  assert.equal(extra.modeExtra, true);
  assert.deepEqual(extra.cards.map((card) => card.id), [future.id]);

  const reload = await startOrResumeStudySessionForUser(userA, { modeExtra: false }, new Date(now.getTime() + 1_000));
  assert.equal(reload.resumed, true);
  assert.equal(reload.modeExtra, true);
  assert.equal(reload.sessionId, extra.sessionId);
  assert.deepEqual(reload.cards.map((card) => card.id), [future.id]);
});
