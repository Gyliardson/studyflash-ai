import test, { after, beforeEach } from "node:test";
import assert from "node:assert/strict";

import prisma from "../lib/db.ts";
import { DAILY_LIMITS, XP_VALUES } from "../lib/gamification.ts";
import {
  STUDY_TIME_ZONE,
  studyCalendarDayDifference,
  studyCalendarDayOrdinal,
  studyDayRange,
} from "../lib/study-calendar.mjs";
import {
  createExamAttemptForUser,
  finalizeExamForUser,
  grantCreationXpForUser,
  processStudyStreakForUser,
} from "../lib/gamification-transactions.mjs";
import {
  recordStudySessionReviewForUser,
  startOrResumeStudySessionForUser,
} from "../lib/study-session-transactions.mjs";

// The implementation must not inherit the GitHub runner/server process timezone.
process.env.TZ = "UTC";

const userId = "timezone-boundary-user";

async function resetDatabase() {
  await prisma.studySessionCard.deleteMany();
  await prisma.studySession.deleteMany();
  await prisma.examQuestion.deleteMany();
  await prisma.examSession.deleteMany();
  await prisma.examAttemptQuestion.deleteMany();
  await prisma.examAttempt.deleteMany();
  await prisma.flashcard.deleteMany();
  await prisma.deck.deleteMany();
  await prisma.xPHistory.deleteMany();
  await prisma.userProfile.deleteMany();
}

beforeEach(resetDatabase);

after(async () => {
  await resetDatabase();
  await prisma.$disconnect();
});

async function createExamAttempt(now) {
  const card = await prisma.flashcard.create({
    data: {
      userId,
      frente: "Timezone question",
      verso: "Timezone answer",
      nextReview: new Date(now.getTime() - 60_000),
    },
  });
  const attempt = await createExamAttemptForUser(userId, {
    difficulty: "EASY",
    sourceType: "GLOBAL",
    questions: [{
      flashcardId: card.id,
      prompt: card.frente,
      expectedAnswer: card.verso,
      options: [card.verso, "Wrong"],
    }],
  }, now);
  assert.equal(attempt.success, true);
  return { ...attempt, card };
}

function examPayload(attempt) {
  return {
    attemptId: attempt.attemptId,
    timeSpentSeconds: 30,
    answers: [{
      flashcardId: attempt.card.id,
      selectedOption: attempt.card.verso,
      timeTaken: 30,
    }],
  };
}

async function seedExamSessions(count, createdAt) {
  for (let index = 0; index < count; index += 1) {
    await prisma.examSession.create({
      data: {
        userId,
        sourceType: "GLOBAL",
        totalQuestions: 1,
        correctAnswers: 1,
        score: 1,
        timeSpentSeconds: 10,
        difficulty: "EASY",
        xpAwarded: 0,
        createdAt,
      },
    });
  }
}

test("StudyFlash uses one explicit canonical timezone", () => {
  assert.equal(STUDY_TIME_ZONE, "America/Sao_Paulo");
});

test("UTC date rollover inside the same StudyFlash day is not a new calendar day", () => {
  const beforeUtcMidnight = new Date("2026-08-14T23:59:00.000Z");
  const afterUtcMidnight = new Date("2026-08-15T00:01:00.000Z");
  assert.equal(studyCalendarDayDifference(afterUtcMidnight, beforeUtcMidnight), 0);
});

test("StudyFlash midnight advances the calendar even when the UTC date is unchanged", () => {
  const beforeStudyMidnight = new Date("2026-08-15T02:59:00.000Z");
  const afterStudyMidnight = new Date("2026-08-15T03:01:00.000Z");
  assert.equal(studyCalendarDayDifference(afterStudyMidnight, beforeStudyMidnight), 1);
});

test("calendar ordinals remain consecutive across a historical 23-hour Sao Paulo DST day", () => {
  const before = new Date("2018-11-03T23:59:00.000-03:00");
  const after = new Date("2018-11-04T23:59:00.000-02:00");
  assert.equal(studyCalendarDayOrdinal(after) - studyCalendarDayOrdinal(before), 1);

  const { start, end } = studyDayRange(new Date("2018-11-04T12:00:00.000Z"));
  assert.equal(start.toISOString(), "2018-11-04T03:00:00.000Z");
  assert.equal(end.toISOString(), "2018-11-05T02:00:00.000Z");
  assert.equal(end.getTime() - start.getTime(), 23 * 60 * 60 * 1000);
});

test("creation XP cap includes earlier UTC-date history from the same StudyFlash day", async () => {
  await prisma.userProfile.create({ data: { userId, xp: DAILY_LIMITS.MAX_XP_FROM_CREATION, weeklyXp: DAILY_LIMITS.MAX_XP_FROM_CREATION } });
  await prisma.xPHistory.create({
    data: {
      userId,
      amount: DAILY_LIMITS.MAX_XP_FROM_CREATION,
      source: "CREATE_CARD",
      createdAt: new Date("2026-08-14T23:00:00.000Z"),
    },
  });

  const awarded = await grantCreationXpForUser(userId, 10, new Date("2026-08-15T02:59:00.000Z"));
  assert.equal(awarded, 0);
  assert.equal(await prisma.xPHistory.count({ where: { userId, source: "CREATE_CARD" } }), 1);
});

test("creation XP cap resets at StudyFlash midnight instead of UTC midnight", async () => {
  await prisma.userProfile.create({ data: { userId, xp: DAILY_LIMITS.MAX_XP_FROM_CREATION, weeklyXp: DAILY_LIMITS.MAX_XP_FROM_CREATION } });
  await prisma.xPHistory.create({
    data: {
      userId,
      amount: DAILY_LIMITS.MAX_XP_FROM_CREATION,
      source: "CREATE_CARD",
      createdAt: new Date("2026-08-15T02:59:00.000Z"),
    },
  });

  const awarded = await grantCreationXpForUser(userId, 10, new Date("2026-08-15T03:01:00.000Z"));
  assert.equal(awarded, 10);
});

test("streak does not increment across UTC midnight while StudyFlash date is unchanged", async () => {
  await prisma.userProfile.create({
    data: {
      userId,
      xp: 0,
      weeklyXp: 0,
      currentStreak: 4,
      longestStreak: 4,
      lastStudyDate: new Date("2026-08-14T23:59:00.000Z"),
    },
  });

  const result = await processStudyStreakForUser(userId, new Date("2026-08-15T00:01:00.000Z"));
  assert.equal(result.streakBonus, false);
  const profile = await prisma.userProfile.findUniqueOrThrow({ where: { userId } });
  assert.equal(profile.currentStreak, 4);
  assert.equal(await prisma.xPHistory.count({ where: { userId, source: "STREAK" } }), 0);
});

test("streak increments exactly at the next StudyFlash calendar day", async () => {
  await prisma.userProfile.create({
    data: {
      userId,
      xp: 0,
      weeklyXp: 0,
      currentStreak: 4,
      longestStreak: 4,
      lastStudyDate: new Date("2026-08-15T02:59:00.000Z"),
    },
  });

  const result = await processStudyStreakForUser(userId, new Date("2026-08-15T03:01:00.000Z"));
  assert.equal(result.streakBonus, true);
  const profile = await prisma.userProfile.findUniqueOrThrow({ where: { userId } });
  assert.equal(profile.currentStreak, 5);
  assert.equal(profile.xp, XP_VALUES.DAILY_STREAK_BONUS);
  assert.equal(await prisma.xPHistory.count({ where: { userId, source: "STREAK" } }), 1);
});

test("exam daily XP cap counts sessions from the full StudyFlash day across UTC dates", async () => {
  const now = new Date("2026-08-15T02:59:00.000Z");
  await seedExamSessions(3, new Date("2026-08-14T23:30:00.000Z"));
  const attempt = await createExamAttempt(now);

  const result = await finalizeExamForUser(userId, examPayload(attempt), now);
  assert.equal(result.success, true);
  assert.equal(result.limitReached, true);
  assert.equal(result.xpGained, 0);
  assert.equal(await prisma.xPHistory.count({ where: { userId, source: "EXAM" } }), 0);
});

test("exam daily XP cap resets at StudyFlash midnight", async () => {
  const now = new Date("2026-08-15T03:01:00.000Z");
  await seedExamSessions(3, new Date("2026-08-15T02:59:00.000Z"));
  const attempt = await createExamAttempt(now);

  const result = await finalizeExamForUser(userId, examPayload(attempt), now);
  assert.equal(result.success, true);
  assert.equal(result.limitReached, false);
  assert.ok(result.xpGained > 0);
  assert.equal(await prisma.xPHistory.count({ where: { userId, source: "EXAM" } }), 1);
});

test("durable study-session reviews use the same canonical streak boundary", async () => {
  const now = new Date("2026-08-15T00:01:00.000Z");
  await prisma.userProfile.create({
    data: {
      userId,
      xp: 0,
      weeklyXp: 0,
      currentStreak: 4,
      longestStreak: 4,
      lastStudyDate: new Date("2026-08-14T23:59:00.000Z"),
    },
  });
  const deck = await prisma.deck.create({ data: { userId, nome: "Timezone study deck" } });
  const card = await prisma.flashcard.create({
    data: {
      userId,
      deckId: deck.id,
      frente: "Study timezone question",
      verso: "Study timezone answer",
      nextReview: new Date(now.getTime() - 60_000),
    },
  });

  const session = await startOrResumeStudySessionForUser(userId, { deckIds: [deck.id] }, now);
  assert.equal(session.success, true);
  assert.equal(session.cards.length, 1);

  const review = await recordStudySessionReviewForUser(userId, session.sessionId, card.id, "facil", now);
  assert.equal(review.success, true);
  const profile = await prisma.userProfile.findUniqueOrThrow({ where: { userId } });
  assert.equal(profile.currentStreak, 4);
  assert.equal(await prisma.xPHistory.count({ where: { userId, source: "STREAK" } }), 0);
});
