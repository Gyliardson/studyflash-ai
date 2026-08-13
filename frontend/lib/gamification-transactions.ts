import { Prisma } from "@prisma/client";

import prisma from "./db.ts";
import { DAILY_LIMITS, XP_VALUES } from "./gamification.ts";

export type ReviewEvaluation = "errei" | "dificil" | "facil";

type TransactionClient = Prisma.TransactionClient;

const MAX_SERIALIZABLE_ATTEMPTS = 3;

function isRetryableTransactionConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}

async function runSerializable<T>(operation: (tx: TransactionClient) => Promise<T>) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_SERIALIZABLE_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      lastError = error;
      if (!isRetryableTransactionConflict(error) || attempt === MAX_SERIALIZABLE_ATTEMPTS) {
        throw error;
      }
    }
  }

  throw lastError;
}

async function ensureProfile(tx: TransactionClient, userId: string) {
  return tx.userProfile.upsert({
    where: { userId },
    create: { userId, xp: 0, weeklyXp: 0 },
    update: {},
  });
}

async function grantXp(
  tx: TransactionClient,
  userId: string,
  amount: number,
  source: string,
) {
  if (amount <= 0) return;

  await tx.userProfile.upsert({
    where: { userId },
    create: { userId, xp: amount, weeklyXp: amount },
    update: {
      xp: { increment: amount },
      weeklyXp: { increment: amount },
    },
  });

  await tx.xPHistory.create({
    data: { userId, amount, source },
  });
}

function startOfLocalDay(value: Date) {
  const result = new Date(value);
  result.setHours(0, 0, 0, 0);
  return result;
}

function localCalendarDayDifference(current: Date, previous: Date) {
  const currentDay = startOfLocalDay(current);
  const previousDay = startOfLocalDay(previous);
  return Math.round((currentDay.getTime() - previousDay.getTime()) / 86_400_000);
}

async function processStreak(
  tx: TransactionClient,
  userId: string,
  now: Date,
) {
  const profile = await ensureProfile(tx, userId);

  if (!profile.lastStudyDate) {
    await tx.userProfile.update({
      where: { userId },
      data: {
        currentStreak: 1,
        longestStreak: Math.max(1, profile.longestStreak),
        lastStudyDate: now,
      },
    });
    return { streakBonus: false };
  }

  const diffDays = localCalendarDayDifference(now, profile.lastStudyDate);
  if (diffDays <= 0) return { streakBonus: false };

  if (diffDays === 1) {
    const nextStreak = profile.currentStreak + 1;
    await tx.userProfile.update({
      where: { userId },
      data: {
        currentStreak: nextStreak,
        longestStreak: Math.max(nextStreak, profile.longestStreak),
        lastStudyDate: now,
      },
    });
    await grantXp(tx, userId, XP_VALUES.DAILY_STREAK_BONUS, "STREAK");
    return { streakBonus: true };
  }

  await tx.userProfile.update({
    where: { userId },
    data: { currentStreak: 1, lastStudyDate: now },
  });
  return { streakBonus: false };
}

export async function processStudyStreakForUser(
  userId: string,
  now: Date = new Date(),
) {
  return runSerializable((tx) => processStreak(tx, userId, now));
}

export async function grantCreationXpForUser(
  userId: string,
  requestedXp: number,
  now: Date = new Date(),
) {
  return runSerializable(async (tx) => {
    await ensureProfile(tx, userId);

    const history = await tx.xPHistory.aggregate({
      _sum: { amount: true },
      where: {
        userId,
        source: "CREATE_CARD",
        createdAt: { gte: startOfLocalDay(now) },
      },
    });

    const alreadyAwarded = history._sum.amount ?? 0;
    const remaining = Math.max(
      0,
      DAILY_LIMITS.MAX_XP_FROM_CREATION - alreadyAwarded,
    );
    const awarded = Math.min(Math.max(0, requestedXp), remaining);

    await grantXp(tx, userId, awarded, "CREATE_CARD");
    return awarded;
  });
}

export async function recordReviewForUser(
  userId: string,
  cardId: string,
  evaluation: ReviewEvaluation,
  now: Date = new Date(),
) {
  return runSerializable(async (tx) => {
    const card = await tx.flashcard.findUnique({
      where: { id: cardId, userId },
    });
    if (!card) return { success: false as const };

    const isScheduledReview = card.nextReview <= now;
    let xpGained = XP_VALUES.REVIEW_EXTRA;
    if (isScheduledReview) {
      if (evaluation === "facil") xpGained = XP_VALUES.REVIEW_EASY;
      else if (evaluation === "dificil") xpGained = XP_VALUES.REVIEW_HARD;
      else xpGained = XP_VALUES.REVIEW_FAIL;
    }

    let { interval, repetition, easinessFactor } = card;
    if (evaluation === "errei") {
      repetition = 0;
      interval = 1;
    } else {
      easinessFactor = evaluation === "dificil"
        ? Math.max(1.3, easinessFactor - 0.15)
        : easinessFactor + 0.15;
      repetition += 1;
      if (repetition === 1) interval = 1;
      else if (repetition === 2) interval = 6;
      else interval = Math.round(interval * easinessFactor);
    }

    const nextReview = new Date(now);
    nextReview.setDate(nextReview.getDate() + interval);

    await tx.flashcard.update({
      where: { id: cardId, userId },
      data: { interval, repetition, easinessFactor, nextReview },
    });
    await grantXp(tx, userId, xpGained, "REVIEW");
    await processStreak(tx, userId, now);

    return { success: true as const, xpGained, isScheduledReview };
  });
}

export async function completeTopicForUser(userId: string, topicId: string) {
  return runSerializable(async (tx) => {
    const topic = await tx.topic.findFirst({
      where: { id: topicId, plan: { userId } },
      select: { id: true, isCompleted: true },
    });

    if (!topic) return { success: false as const, error: "Tópico não encontrado" };
    if (topic.isCompleted) return { success: false as const, error: "Já concluído!" };

    await tx.topic.update({
      where: { id: topicId },
      data: { isCompleted: true },
    });
    await grantXp(tx, userId, XP_VALUES.COMPLETE_TOPIC, "COMPLETE_TOPIC");

    return { success: true as const };
  });
}
