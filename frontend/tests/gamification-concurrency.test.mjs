import test, { after, beforeEach } from "node:test";
import assert from "node:assert/strict";

import prisma from "../lib/db.ts";
import { DAILY_LIMITS, XP_VALUES } from "../lib/gamification.ts";
import {
  completeTopicForUser,
  createExamAttemptForUser,
  finalizeExamForUser,
  processStudyStreakForUser,
  recordReviewForUser,
  saveFlashcardsForUser,
} from "../lib/gamification-transactions.mjs";

const userA = "gamification-user-a";
const userB = "gamification-user-b";
const now = new Date("2026-08-13T12:00:00.000Z");

async function resetDatabase() {
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

async function createDueCard(userId = userA, overrides = {}) {
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

async function createAttempt({
  userId = userA,
  difficulty = "EASY",
  sourceType = "GLOBAL",
  sourceId,
  cards,
  createdAt = now,
} = {}) {
  const attemptCards = cards ?? [await createDueCard(userId)];
  const result = await createExamAttemptForUser(userId, {
    difficulty,
    sourceType,
    sourceId,
    questions: attemptCards.map((card, index) => ({
      flashcardId: card.id,
      prompt: card.frente,
      expectedAnswer: card.verso,
      options: [card.verso, `Wrong ${index + 1}`],
    })),
  }, createdAt);
  assert.equal(result.success, true);
  return { ...result, cards: attemptCards };
}

function finalizePayload(attempt, selectedOption = attempt.cards[0].verso, extra = {}) {
  return {
    attemptId: attempt.attemptId,
    timeSpentSeconds: 30,
    answers: attempt.cards.map((card) => ({
      flashcardId: card.id,
      selectedOption,
      timeTaken: 30,
    })),
    ...extra,
  };
}

test("concurrent review submissions award one scheduled-review XP grant", async () => {
  const card = await createDueCard();
  const results = await Promise.all([
    recordReviewForUser(userA, card.id, "facil", now),
    recordReviewForUser(userA, card.id, "facil", now),
  ]);
  assert.equal(results.filter((result) => result.success).length, 2);
  assert.equal(results.reduce((sum, result) => sum + (result.xpGained ?? 0), 0), XP_VALUES.REVIEW_EASY);
  assert.equal(results.filter((result) => result.isScheduledReview).length, 1);
  const profile = await prisma.userProfile.findUniqueOrThrow({ where: { userId: userA } });
  assert.equal(profile.xp, XP_VALUES.REVIEW_EASY);
  assert.equal(await prisma.xPHistory.count({ where: { userId: userA, source: "REVIEW" } }), 1);
  const updatedCard = await prisma.flashcard.findUniqueOrThrow({ where: { id: card.id } });
  assert.ok(updatedCard.nextReview > now);
});

test("a retry after the winning review cannot award the same opportunity again", async () => {
  const card = await createDueCard();
  const first = await recordReviewForUser(userA, card.id, "dificil", now);
  const retry = await recordReviewForUser(userA, card.id, "dificil", now);
  assert.equal(first.xpGained, XP_VALUES.REVIEW_HARD);
  assert.equal(retry.xpGained, XP_VALUES.REVIEW_EXTRA);
  assert.equal(await prisma.xPHistory.aggregate({
    _sum: { amount: true },
    where: { userId: userA, source: "REVIEW" },
  }).then((value) => value._sum.amount ?? 0), XP_VALUES.REVIEW_HARD);
});

test("review ownership is enforced inside the serializable transaction", async () => {
  const foreignCard = await createDueCard(userB);
  const result = await recordReviewForUser(userA, foreignCard.id, "facil", now);
  assert.deepEqual(result, { success: false });
  assert.equal(await prisma.xPHistory.count({ where: { userId: userA } }), 0);
  const card = await prisma.flashcard.findUniqueOrThrow({ where: { id: foreignCard.id } });
  assert.ok(card.nextReview < now);
});

test("review XP failure rolls back SRS, profile, streak, and ledger state", async () => {
  const dueAt = new Date(now.getTime() - 60_000);
  const card = await prisma.flashcard.create({
    data: { userId: userA, frente: "Question", verso: "Answer", nextReview: dueAt },
  });
  const lastStudyDate = new Date(now);
  lastStudyDate.setDate(lastStudyDate.getDate() - 1);
  await prisma.userProfile.create({
    data: {
      userId: userA,
      xp: 2_147_483_647,
      weeklyXp: 2_147_483_647,
      currentStreak: 4,
      longestStreak: 4,
      lastStudyDate,
    },
  });

  await assert.rejects(() => recordReviewForUser(userA, card.id, "facil", now));

  const unchangedCard = await prisma.flashcard.findUniqueOrThrow({ where: { id: card.id } });
  assert.equal(unchangedCard.nextReview.getTime(), dueAt.getTime());
  assert.equal(unchangedCard.repetition, 0);
  assert.equal(unchangedCard.interval, 0);

  const profile = await prisma.userProfile.findUniqueOrThrow({ where: { userId: userA } });
  assert.equal(profile.xp, 2_147_483_647);
  assert.equal(profile.weeklyXp, 2_147_483_647);
  assert.equal(profile.currentStreak, 4);
  assert.equal(profile.longestStreak, 4);
  assert.equal(profile.lastStudyDate?.getTime(), lastStudyDate.getTime());
  assert.equal(await prisma.xPHistory.count({ where: { userId: userA } }), 0);
});

test("concurrent card saves cannot exceed creation XP cap and persist cards atomically", async () => {
  const deck = await prisma.deck.create({ data: { userId: userA, nome: "Deck" } });
  await prisma.userProfile.create({ data: { userId: userA, xp: 45, weeklyXp: 45 } });
  await prisma.xPHistory.create({ data: { userId: userA, amount: 45, source: "CREATE_CARD", createdAt: now } });
  const results = await Promise.all([
    saveFlashcardsForUser(userA, [{ frente: "Q1", verso: "A1" }], deck.id, now),
    saveFlashcardsForUser(userA, [{ frente: "Q2", verso: "A2" }], deck.id, now),
  ]);
  assert.equal(results.filter((result) => result.success).length, 2);
  assert.equal(results.reduce((sum, result) => sum + result.xpGained, 0), 5);
  assert.equal(await prisma.flashcard.count({ where: { userId: userA, deckId: deck.id } }), 2);
  const creationTotal = await prisma.xPHistory.aggregate({
    _sum: { amount: true },
    where: { userId: userA, source: "CREATE_CARD", createdAt: { gte: new Date("2026-08-13T00:00:00.000Z") } },
  });
  assert.equal(creationTotal._sum.amount, DAILY_LIMITS.MAX_XP_FROM_CREATION);
  const profile = await prisma.userProfile.findUniqueOrThrow({ where: { userId: userA } });
  assert.equal(profile.xp, DAILY_LIMITS.MAX_XP_FROM_CREATION);
});

test("card save rejects a foreign deck without cards, profile, or XP history", async () => {
  const foreignDeck = await prisma.deck.create({ data: { userId: userB, nome: "Foreign" } });
  const result = await saveFlashcardsForUser(userA, [{ frente: "Question", verso: "Answer" }], foreignDeck.id, now);
  assert.equal(result.success, false);
  assert.equal(await prisma.flashcard.count({ where: { userId: userA } }), 0);
  assert.equal(await prisma.userProfile.count({ where: { userId: userA } }), 0);
  assert.equal(await prisma.xPHistory.count({ where: { userId: userA } }), 0);
});

test("failed card persistence rolls back generated deck, profile, and XP ledger", async () => {
  await assert.rejects(() => saveFlashcardsForUser(userA, [{ frente: null, verso: "Answer" }], undefined, now));
  assert.equal(await prisma.deck.count({ where: { userId: userA } }), 0);
  assert.equal(await prisma.flashcard.count({ where: { userId: userA } }), 0);
  assert.equal(await prisma.userProfile.count({ where: { userId: userA } }), 0);
  assert.equal(await prisma.xPHistory.count({ where: { userId: userA } }), 0);
});

test("concurrent topic completion awards XP exactly once", async () => {
  const plan = await prisma.studyPlan.create({
    data: { userId: userA, title: "Plan", difficulty: "EASY", topics: { create: [{ title: "Topic", order: 1 }] } },
    include: { topics: true },
  });
  const results = await Promise.all([
    completeTopicForUser(userA, plan.topics[0].id),
    completeTopicForUser(userA, plan.topics[0].id),
  ]);
  assert.equal(results.filter((result) => result.success).length, 1);
  const profile = await prisma.userProfile.findUniqueOrThrow({ where: { userId: userA } });
  assert.equal(profile.xp, XP_VALUES.COMPLETE_TOPIC);
  assert.equal(await prisma.xPHistory.count({ where: { userId: userA, source: "COMPLETE_TOPIC" } }), 1);
});

test("concurrent first-study streak processing creates one stable streak without bonus", async () => {
  const results = await Promise.all([
    processStudyStreakForUser(userA, now),
    processStudyStreakForUser(userA, now),
  ]);
  assert.equal(results.filter((result) => result.streakBonus).length, 0);
  const profile = await prisma.userProfile.findUniqueOrThrow({ where: { userId: userA } });
  assert.equal(profile.currentStreak, 1);
  assert.equal(profile.longestStreak, 1);
  assert.equal(profile.xp, 0);
  assert.equal(await prisma.xPHistory.count({ where: { userId: userA, source: "STREAK" } }), 0);
});

test("concurrent next-day streak processing increments and rewards once", async () => {
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  await prisma.userProfile.create({
    data: { userId: userA, xp: 0, weeklyXp: 0, currentStreak: 4, longestStreak: 4, lastStudyDate: yesterday },
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
  assert.equal(await prisma.xPHistory.count({ where: { userId: userA, source: "STREAK" } }), 1);
});

test("streak after a missed day resets to one and records the new study date without bonus", async () => {
  const previousStudy = new Date(now);
  previousStudy.setDate(previousStudy.getDate() - 2);
  await prisma.userProfile.create({
    data: { userId: userA, xp: 20, weeklyXp: 20, currentStreak: 7, longestStreak: 9, lastStudyDate: previousStudy },
  });

  const result = await processStudyStreakForUser(userA, now);
  assert.equal(result.streakBonus, false);

  const profile = await prisma.userProfile.findUniqueOrThrow({ where: { userId: userA } });
  assert.equal(profile.currentStreak, 1);
  assert.equal(profile.longestStreak, 9);
  assert.equal(profile.lastStudyDate?.getTime(), now.getTime());
  assert.equal(profile.xp, 20);
  assert.equal(await prisma.xPHistory.count({ where: { userId: userA, source: "STREAK" } }), 0);
});

test("exam score and XP are recomputed from the server attempt snapshot", async () => {
  const attempt = await createAttempt({ difficulty: "EASY" });
  const result = await finalizeExamForUser(userA, finalizePayload(attempt, "Wrong 1", {
    difficulty: "IMPOSSIBLE",
    sourceType: "DECK",
    isCorrect: true,
  }), now);

  assert.equal(result.success, true);
  assert.equal(result.correctAnswers, 0);
  assert.equal(result.score, 0);
  assert.equal(result.difficulty, "EASY");
  assert.equal(result.sourceType, "GLOBAL");
  assert.equal(result.xpGained, XP_VALUES.EXAM_COMPLETION);

  const session = await prisma.examSession.findUniqueOrThrow({ where: { attemptId: attempt.attemptId } });
  assert.equal(session.correctAnswers, 0);
  assert.equal(session.difficulty, "EASY");
  assert.equal(session.sourceType, "GLOBAL");
});

test("legacy isCorrect claims cannot turn a wrong selected option into a correct answer", async () => {
  const attempt = await createAttempt();
  const payload = finalizePayload(attempt, "Wrong 1");
  payload.answers[0].isCorrect = true;
  const result = await finalizeExamForUser(userA, payload, now);
  assert.equal(result.success, true);
  assert.equal(result.correctAnswers, 0);
  assert.equal(result.score, 0);
});

test("sequential replay of an exam attempt creates one session and one XP grant", async () => {
  const attempt = await createAttempt();
  const payload = finalizePayload(attempt);
  const first = await finalizeExamForUser(userA, payload, now);
  const replay = await finalizeExamForUser(userA, payload, now);

  assert.equal(first.success, true);
  assert.equal(replay.success, false);
  assert.equal(await prisma.examSession.count({ where: { attemptId: attempt.attemptId } }), 1);
  assert.equal(await prisma.xPHistory.count({ where: { userId: userA, source: "EXAM" } }), 1);
});

test("concurrent replay of one exam attempt grants XP exactly once", async () => {
  const attempt = await createAttempt();
  const payload = finalizePayload(attempt);
  const results = await Promise.all([
    finalizeExamForUser(userA, payload, now),
    finalizeExamForUser(userA, payload, now),
  ]);

  assert.equal(results.filter((result) => result.success).length, 1);
  assert.equal(await prisma.examSession.count({ where: { attemptId: attempt.attemptId } }), 1);
  assert.equal(await prisma.xPHistory.count({ where: { userId: userA, source: "EXAM" } }), 1);
});

test("expired exam attempt is rejected and cannot mutate XP or session state", async () => {
  const createdAt = new Date(now.getTime() - (3 * 60 * 60 * 1000));
  const attempt = await createAttempt({ createdAt });
  const result = await finalizeExamForUser(userA, finalizePayload(attempt), now);

  assert.equal(result.success, false);
  const stored = await prisma.examAttempt.findUniqueOrThrow({ where: { id: attempt.attemptId } });
  assert.equal(stored.status, "EXPIRED");
  assert.equal(await prisma.examSession.count(), 0);
  assert.equal(await prisma.xPHistory.count({ where: { source: "EXAM" } }), 0);
});

test("unknown and cross-user exam attempts are rejected without partial writes", async () => {
  const unknown = await finalizeExamForUser(userA, {
    attemptId: "unknown-attempt",
    timeSpentSeconds: 1,
    answers: [],
  }, now);
  assert.equal(unknown.success, false);

  const foreignAttempt = await createAttempt({ userId: userB });
  const crossUser = await finalizeExamForUser(userA, finalizePayload(foreignAttempt), now);
  assert.equal(crossUser.success, false);
  assert.equal(await prisma.examSession.count(), 0);
  assert.equal(await prisma.xPHistory.count({ where: { userId: userA, source: "EXAM" } }), 0);
});

test("partial, duplicate, and forged-option answer sets are rejected while attempt stays reusable", async () => {
  const card1 = await createDueCard(userA, { frente: "Q1", verso: "A1" });
  const card2 = await createDueCard(userA, { frente: "Q2", verso: "A2" });
  const attempt = await createAttempt({ cards: [card1, card2] });

  const partial = await finalizeExamForUser(userA, {
    attemptId: attempt.attemptId,
    timeSpentSeconds: 10,
    answers: [{ flashcardId: card1.id, selectedOption: "A1", timeTaken: 5 }],
  }, now);
  assert.equal(partial.success, false);

  const duplicate = await finalizeExamForUser(userA, {
    attemptId: attempt.attemptId,
    timeSpentSeconds: 10,
    answers: [
      { flashcardId: card1.id, selectedOption: "A1", timeTaken: 5 },
      { flashcardId: card1.id, selectedOption: "A1", timeTaken: 5 },
    ],
  }, now);
  assert.equal(duplicate.success, false);

  const forged = await finalizeExamForUser(userA, {
    attemptId: attempt.attemptId,
    timeSpentSeconds: 10,
    answers: [
      { flashcardId: card1.id, selectedOption: "not-an-option", timeTaken: 5 },
      { flashcardId: card2.id, selectedOption: "A2", timeTaken: 5 },
    ],
  }, now);
  assert.equal(forged.success, false);

  const stored = await prisma.examAttempt.findUniqueOrThrow({ where: { id: attempt.attemptId } });
  assert.equal(stored.status, "ACTIVE");
  assert.equal(await prisma.examSession.count(), 0);
  assert.equal(await prisma.xPHistory.count({ where: { source: "EXAM" } }), 0);
});

test("attempt creation rejects foreign flashcards and invalid source ownership", async () => {
  const foreignCard = await createDueCard(userB);
  const foreignCardResult = await createExamAttemptForUser(userA, {
    difficulty: "EASY",
    sourceType: "GLOBAL",
    questions: [{
      flashcardId: foreignCard.id,
      prompt: foreignCard.frente,
      expectedAnswer: foreignCard.verso,
      options: [foreignCard.verso, "Wrong"],
    }],
  }, now);
  assert.equal(foreignCardResult.success, false);

  const foreignDeck = await prisma.deck.create({ data: { userId: userB, nome: "Foreign" } });
  const ownCard = await createDueCard(userA);
  const foreignSourceResult = await createExamAttemptForUser(userA, {
    difficulty: "EASY",
    sourceType: "DECK",
    sourceId: foreignDeck.id,
    questions: [{
      flashcardId: ownCard.id,
      prompt: ownCard.frente,
      expectedAnswer: ownCard.verso,
      options: [ownCard.verso, "Wrong"],
    }],
  }, now);
  assert.equal(foreignSourceResult.success, false);
  assert.equal(await prisma.examAttempt.count(), 0);
});

test("concurrent exam completions cannot exceed the daily XP-eligible session limit", async () => {
  const card = await createDueCard();
  await prisma.userProfile.create({ data: { userId: userA, xp: 0, weeklyXp: 0, lastStudyDate: now } });
  for (let index = 0; index < 2; index += 1) {
    await prisma.examSession.create({
      data: { userId: userA, sourceType: "GLOBAL", totalQuestions: 1, correctAnswers: 1, score: 1, timeSpentSeconds: 10, difficulty: "EASY", xpAwarded: 0, createdAt: now },
    });
  }
  const attempt1 = await createAttempt({ cards: [card] });
  const attempt2 = await createAttempt({ cards: [card] });
  const results = await Promise.all([
    finalizeExamForUser(userA, finalizePayload(attempt1), now),
    finalizeExamForUser(userA, finalizePayload(attempt2), now),
  ]);
  assert.equal(results.filter((result) => result.success).length, 2);
  assert.equal(results.filter((result) => result.xpGained > 0).length, 1);
  assert.equal(results.filter((result) => result.limitReached).length, 1);
  assert.equal(await prisma.examSession.count({ where: { userId: userA } }), 4);
  assert.equal(await prisma.xPHistory.count({ where: { userId: userA, source: "EXAM" } }), 1);
  const profile = await prisma.userProfile.findUniqueOrThrow({ where: { userId: userA } });
  const expectedXp = XP_VALUES.EXAM_COMPLETION + XP_VALUES.EXAM_PER_CORRECT_EASY + XP_VALUES.EXAM_PERFECT_BONUS;
  assert.equal(profile.xp, expectedXp);
});
