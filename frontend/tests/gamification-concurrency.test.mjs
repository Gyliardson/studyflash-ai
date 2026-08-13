import test, { after, beforeEach } from "node:test";
import assert from "node:assert/strict";

import prisma from "../lib/db.ts";
import { DAILY_LIMITS, XP_VALUES } from "../lib/gamification.ts";
import {
  completeTopicForUser,
  finalizeExamForUser,
  grantCreationXpForUser,
  processStudyStreakForUser,
  recordReviewForUser,
} from "../lib/gamification-transactions.mjs";

const userA = "gamification-user-a";
const userB = "gamification-user-b";
const now = new Date("2026-08-13T12:00:00.000Z");

async function resetDatabase() {
  await prisma.examQuestion.deleteMany();
  await prisma.examSession.deleteMany();
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

async function createDueCard(userId = userA) {
  return prisma.flashcard.create({
    data: {
      userId,
      frente: "Question",
      verso: "Answer",
      nextReview: new Date(now.getTime() - 60_000),
    },
  });
}

function examResult(cardId) {
  return {
    difficulty: "EASY",
    sourceType: "GLOBAL",
    timeSpentSeconds: 30,
    answers: [{ flashcardId: cardId, isCorrect: true, timeTaken: 30 }],
  };
}

test("concurrent review submissions award one scheduled-review XP grant", async () => {
  const card = await createDueCard();

  const results = await Promise.all([
    recordReviewForUser(userA, card.id, "facil", now),
    recordReviewForUser(userA, card.id, "facil", now),
  ]);

  assert.equal(results.filter((result) => result.success).length, 2);
  assert.equal(
    results.reduce((sum, result) => sum + (result.xpGained ?? 0), 0),
    XP_VALUES.REVIEW_EASY,
  );
  assert.equal(results.filter((result) => result.isScheduledReview).length, 1);

  const profile = await prisma.userProfile.findUniqueOrThrow({ where: { userId: userA } });
  assert.equal(profile.xp, XP_VALUES.REVIEW_EASY);
  assert.equal(
    await prisma.xPHistory.count({ where: { userId: userA, source: "REVIEW" } }),
    1,
  );

  const updatedCard = await prisma.flashcard.findUniqueOrThrow({ where: { id: card.id } });
  assert.ok(updatedCard.nextReview > now);
});

test("a retry after the winning review cannot award the same opportunity again", async () => {
  const card = await createDueCard();

  const first = await recordReviewForUser(userA, card.id, "dificil", now);
  const retry = await recordReviewForUser(userA, card.id, "dificil", now);

  assert.equal(first.xpGained, XP_VALUES.REVIEW_HARD);
  assert.equal(retry.xpGained, XP_VALUES.REVIEW_EXTRA);
  assert.equal(
    await prisma.xPHistory.aggregate({
      _sum: { amount: true },
      where: { userId: userA, source: "REVIEW" },
    }).then((value) => value._sum.amount ?? 0),
    XP_VALUES.REVIEW_HARD,
  );
});

test("review ownership is enforced inside the serializable transaction", async () => {
  const foreignCard = await createDueCard(userB);

  const result = await recordReviewForUser(userA, foreignCard.id, "facil", now);

  assert.deepEqual(result, { success: false });
  assert.equal(await prisma.xPHistory.count({ where: { userId: userA } }), 0);
  const card = await prisma.flashcard.findUniqueOrThrow({ where: { id: foreignCard.id } });
  assert.ok(card.nextReview < now);
});

test("concurrent creation XP grants cannot exceed the daily cap", async () => {
  await prisma.userProfile.create({
    data: { userId: userA, xp: 45, weeklyXp: 45 },
  });
  await prisma.xPHistory.create({
    data: { userId: userA, amount: 45, source: "CREATE_CARD", createdAt: now },
  });

  const awards = await Promise.all([
    grantCreationXpForUser(userA, 10, now),
    grantCreationXpForUser(userA, 10, now),
  ]);

  assert.equal(awards.reduce((sum, award) => sum + award, 0), 5);

  const creationTotal = await prisma.xPHistory.aggregate({
    _sum: { amount: true },
    where: { userId: userA, source: "CREATE_CARD", createdAt: { gte: new Date("2026-08-13T00:00:00.000Z") } },
  });
  assert.equal(creationTotal._sum.amount, DAILY_LIMITS.MAX_XP_FROM_CREATION);

  const profile = await prisma.userProfile.findUniqueOrThrow({ where: { userId: userA } });
  assert.equal(profile.xp, DAILY_LIMITS.MAX_XP_FROM_CREATION);
});

test("concurrent topic completion awards XP exactly once", async () => {
  const plan = await prisma.studyPlan.create({
    data: {
      userId: userA,
      title: "Plan",
      difficulty: "EASY",
      topics: { create: [{ title: "Topic", order: 1 }] },
    },
    include: { topics: true },
  });

  const results = await Promise.all([
    completeTopicForUser(userA, plan.topics[0].id),
    completeTopicForUser(userA, plan.topics[0].id),
  ]);

  assert.equal(results.filter((result) => result.success).length, 1);
  const profile = await prisma.userProfile.findUniqueOrThrow({ where: { userId: userA } });
  assert.equal(profile.xp, XP_VALUES.COMPLETE_TOPIC);
  assert.equal(
    await prisma.xPHistory.count({ where: { userId: userA, source: "COMPLETE_TOPIC" } }),
    1,
  );
});

test("concurrent next-day streak processing increments and rewards once", async () => {
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  await prisma.userProfile.create({
    data: {
      userId: userA,
      xp: 0,
      weeklyXp: 0,
      currentStreak: 4,
      longestStreak: 4,
      lastStudyDate: yesterday,
    },
  });

  const results = await Promise.all([
    processStudyStreakForUser(userA, now),
    processStudyStreakForUser(userA, now),
  ]);

  assert.equal(results.filter((result) => result.streakBonus).length, 1);
  const profile = await prisma.userProfile.findUniqueOrThrow({ where: { userId: userA } });
  assert.equal(profile.currentStreak, 5);
  assert.equal(profile.longestStreak, 5);
  assert.equal(profile.xp, XP_VALUES.DAILY_STREAK_BONUS);
  assert.equal(
    await prisma.xPHistory.count({ where: { userId: userA, source: "STREAK" } }),
    1,
  );
});

test("concurrent exam completions cannot exceed the daily XP-eligible session limit", async () => {
  const card = await createDueCard();
  await prisma.userProfile.create({ data: { userId: userA, xp: 0, weeklyXp: 0, lastStudyDate: now } });

  for (let index = 0; index < 2; index += 1) {
    await prisma.examSession.create({
      data: {
        userId: userA,
        sourceType: "GLOBAL",
        totalQuestions: 1,
        correctAnswers: 1,
        score: 1,
        timeSpentSeconds: 10,
        difficulty: "EASY",
        xpAwarded: 0,
        createdAt: now,
      },
    });
  }

  const results = await Promise.all([
    finalizeExamForUser(userA, examResult(card.id), now),
    finalizeExamForUser(userA, examResult(card.id), now),
  ]);

  assert.equal(results.filter((result) => result.success).length, 2);
  assert.equal(results.filter((result) => result.xpGained > 0).length, 1);
  assert.equal(results.filter((result) => result.limitReached).length, 1);
  assert.equal(await prisma.examSession.count({ where: { userId: userA } }), 4);
  assert.equal(await prisma.xPHistory.count({ where: { userId: userA, source: "EXAM" } }), 1);

  const profile = await prisma.userProfile.findUniqueOrThrow({ where: { userId: userA } });
  const expectedXp = XP_VALUES.EXAM_COMPLETION
    + XP_VALUES.EXAM_PER_CORRECT_EASY
    + XP_VALUES.EXAM_PERFECT_BONUS;
  assert.equal(profile.xp, expectedXp);
});

test("exam finalization rejects another user's flashcard without partial writes", async () => {
  const foreignCard = await createDueCard(userB);

  const result = await finalizeExamForUser(userA, examResult(foreignCard.id), now);

  assert.equal(result.success, false);
  assert.equal(await prisma.examSession.count({ where: { userId: userA } }), 0);
  assert.equal(await prisma.xPHistory.count({ where: { userId: userA } }), 0);
});
