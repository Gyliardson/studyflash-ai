import { Prisma } from "@prisma/client";
import prisma from "./db.ts";
import { XP_VALUES } from "./gamification.ts";

const MAX_SERIALIZABLE_ATTEMPTS = 5;
const VALID_EVALUATIONS = new Set(["errei", "dificil", "facil"]);

class RetryableReviewClaimError extends Error {}

function isRetryableTransactionConflict(error) {
  if (error instanceof RetryableReviewClaimError) return true;
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code === "P2034") return true;
  if (error.code !== "P2002") return false;
  return error.meta?.modelName === "UserProfile" || error.meta?.modelName === "StudySession";
}

async function runSerializable(operation) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_SERIALIZABLE_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      lastError = error;
      if (!isRetryableTransactionConflict(error) || attempt === MAX_SERIALIZABLE_ATTEMPTS) throw error;
    }
  }
  throw lastError;
}

function ensureProfile(tx, userId) {
  return tx.userProfile.upsert({
    where: { userId },
    create: { userId, xp: 0, weeklyXp: 0 },
    update: {},
  });
}

async function grantXp(tx, userId, amount, source) {
  if (amount <= 0) return;
  await tx.userProfile.upsert({
    where: { userId },
    create: { userId, xp: amount, weeklyXp: amount },
    update: { xp: { increment: amount }, weeklyXp: { increment: amount } },
  });
  await tx.xPHistory.create({ data: { userId, amount, source } });
}

function startOfLocalDay(value) {
  const result = new Date(value);
  result.setHours(0, 0, 0, 0);
  return result;
}

function localCalendarDayDifference(current, previous) {
  return Math.round((startOfLocalDay(current).getTime() - startOfLocalDay(previous).getTime()) / 86_400_000);
}

async function processStreak(tx, userId, now) {
  const profile = await ensureProfile(tx, userId);
  if (!profile.lastStudyDate) {
    await tx.userProfile.update({
      where: { userId },
      data: { currentStreak: 1, longestStreak: Math.max(1, profile.longestStreak), lastStudyDate: now },
    });
    return;
  }
  const diffDays = localCalendarDayDifference(now, profile.lastStudyDate);
  if (diffDays <= 0) return;
  if (diffDays === 1) {
    const nextStreak = profile.currentStreak + 1;
    await tx.userProfile.update({
      where: { userId },
      data: { currentStreak: nextStreak, longestStreak: Math.max(nextStreak, profile.longestStreak), lastStudyDate: now },
    });
    await grantXp(tx, userId, XP_VALUES.DAILY_STREAK_BONUS, "STREAK");
    return;
  }
  await tx.userProfile.update({ where: { userId }, data: { currentStreak: 1, lastStudyDate: now } });
}

function normalizeScope(userId, input) {
  if (input?.topicId) {
    return {
      scopeKey: `TOPIC:${input.topicId}`,
      where: { userId, topicId: input.topicId, topic: { plan: { userId } } },
    };
  }
  if (input?.planId) {
    return {
      scopeKey: `PLAN:${input.planId}`,
      where: { userId, topic: { planId: input.planId, plan: { userId } } },
    };
  }
  const deckIds = Array.isArray(input?.deckIds)
    ? [...new Set(input.deckIds.filter((id) => typeof id === "string" && id.length > 0))].sort()
    : [];
  if (deckIds.length > 0) {
    return {
      scopeKey: `DECKS:${deckIds.join(",")}`,
      where: { userId, deckId: { in: deckIds }, deck: { userId } },
    };
  }
  return { scopeKey: "GLOBAL", where: { userId } };
}

function pendingCards(session) {
  return session.cards.map((item) => ({
    id: item.flashcard.id,
    frente: item.flashcard.frente,
    verso: item.flashcard.verso,
  }));
}

export function startOrResumeStudySessionForUser(userId, input = {}, now = new Date()) {
  return runSerializable(async (tx) => {
    const scope = normalizeScope(userId, input);
    const active = await tx.studySession.findFirst({
      where: { userId, scopeKey: scope.scopeKey, status: "ACTIVE" },
      orderBy: { updatedAt: "desc" },
      include: {
        cards: {
          where: { status: "PENDING" },
          orderBy: { order: "asc" },
          include: { flashcard: true },
        },
      },
    });

    if (active?.cards.length) {
      return {
        success: true,
        sessionId: active.id,
        modeExtra: active.modeExtra,
        resumed: true,
        cards: pendingCards(active),
      };
    }

    if (active) {
      await tx.studySession.update({
        where: { id: active.id },
        data: { status: "COMPLETED", activeKey: null },
      });
    }

    const modeExtra = Boolean(input?.modeExtra);
    const where = modeExtra ? scope.where : { ...scope.where, nextReview: { lte: now } };
    const cards = await tx.flashcard.findMany({
      where,
      orderBy: { nextReview: "asc" },
      take: 20,
      select: { id: true, frente: true, verso: true },
    });
    if (cards.length === 0) {
      return { success: true, cards: [], modeExtra, resumed: false };
    }

    const activeKey = `${userId}|${modeExtra ? "EXTRA" : "DUE"}|${scope.scopeKey}`;
    const session = await tx.studySession.create({
      data: {
        userId,
        scopeKey: scope.scopeKey,
        modeExtra,
        activeKey,
        cards: { create: cards.map((card, order) => ({ flashcardId: card.id, order })) },
      },
      include: {
        cards: {
          where: { status: "PENDING" },
          orderBy: { order: "asc" },
          include: { flashcard: true },
        },
      },
    });
    return {
      success: true,
      sessionId: session.id,
      modeExtra,
      resumed: false,
      cards: pendingCards(session),
    };
  });
}

export function recordStudySessionReviewForUser(userId, sessionId, cardId, evaluation, now = new Date()) {
  if (!VALID_EVALUATIONS.has(evaluation)) {
    return Promise.resolve({ success: false, error: "Avaliação inválida." });
  }

  return runSerializable(async (tx) => {
    const item = await tx.studySessionCard.findFirst({
      where: { sessionId, flashcardId: cardId, session: { userId } },
      include: { session: true, flashcard: true },
    });
    if (!item || item.flashcard.userId !== userId) {
      return { success: false, error: "Cartão de estudo não encontrado." };
    }
    if (item.status === "COMMITTED") {
      return {
        success: true,
        replayed: true,
        xpGained: item.xpGained ?? 0,
        isScheduledReview: item.isScheduledReview ?? false,
      };
    }
    if (item.session.status !== "ACTIVE") {
      return { success: false, error: "Esta sessão de estudo não está mais ativa." };
    }

    const claim = await tx.studySessionCard.updateMany({
      where: { id: item.id, status: "PENDING" },
      data: { status: "COMMITTING" },
    });
    if (claim.count !== 1) throw new RetryableReviewClaimError("Review item is already being committed.");

    const card = item.flashcard;
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
      easinessFactor = evaluation === "dificil" ? Math.max(1.3, easinessFactor - 0.15) : easinessFactor + 0.15;
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
    await tx.studySessionCard.update({
      where: { id: item.id },
      data: {
        status: "COMMITTED",
        evaluation,
        xpGained,
        isScheduledReview,
        committedAt: now,
      },
    });

    const remaining = await tx.studySessionCard.count({
      where: { sessionId, status: { in: ["PENDING", "COMMITTING"] } },
    });
    if (remaining === 0) {
      await tx.studySession.update({
        where: { id: sessionId },
        data: { status: "COMPLETED", activeKey: null },
      });
    }

    return { success: true, replayed: false, xpGained, isScheduledReview };
  });
}
