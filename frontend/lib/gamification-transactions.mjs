import { Prisma } from "@prisma/client";
import prisma from "./db.ts";
import { DAILY_LIMITS, XP_VALUES } from "./gamification.ts";

const MAX_SERIALIZABLE_ATTEMPTS = 5;
const DAILY_EXAM_XP_LIMIT = 3;
const EXAM_DIFFICULTIES = new Set(["EASY", "MEDIUM", "HARD", "IMPOSSIBLE"]);
const EXAM_SOURCE_TYPES = new Set(["DECK", "TOPIC", "PLAN", "GLOBAL"]);

function isRetryableTransactionConflict(error) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code === "P2034") return true;
  if (error.code !== "P2002") return false;

  // Two concurrent first-use requests may both attempt to bootstrap the same
  // UserProfile. userId is the model's only unique business key, so this
  // conflict is safe to retry from the start of the serializable transaction.
  return error.meta?.modelName === "UserProfile";
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
    return { streakBonus: false };
  }
  const diffDays = localCalendarDayDifference(now, profile.lastStudyDate);
  if (diffDays <= 0) return { streakBonus: false };
  if (diffDays === 1) {
    const nextStreak = profile.currentStreak + 1;
    await tx.userProfile.update({
      where: { userId },
      data: { currentStreak: nextStreak, longestStreak: Math.max(nextStreak, profile.longestStreak), lastStudyDate: now },
    });
    await grantXp(tx, userId, XP_VALUES.DAILY_STREAK_BONUS, "STREAK");
    return { streakBonus: true };
  }
  await tx.userProfile.update({ where: { userId }, data: { currentStreak: 1, lastStudyDate: now } });
  return { streakBonus: false };
}

export function processStudyStreakForUser(userId, now = new Date()) {
  return runSerializable((tx) => processStreak(tx, userId, now));
}

async function grantCreationXp(tx, userId, requestedXp, now) {
  await ensureProfile(tx, userId);
  const history = await tx.xPHistory.aggregate({
    _sum: { amount: true },
    where: { userId, source: "CREATE_CARD", createdAt: { gte: startOfLocalDay(now) } },
  });
  const remaining = Math.max(0, DAILY_LIMITS.MAX_XP_FROM_CREATION - (history._sum.amount ?? 0));
  const awarded = Math.min(Math.max(0, requestedXp), remaining);
  await grantXp(tx, userId, awarded, "CREATE_CARD");
  return awarded;
}

export function grantCreationXpForUser(userId, requestedXp, now = new Date()) {
  return runSerializable((tx) => grantCreationXp(tx, userId, requestedXp, now));
}

export function saveFlashcardsForUser(userId, cards, deckId, now = new Date(), newDeckName) {
  if (!Array.isArray(cards) || cards.length === 0) return Promise.resolve({ success: false, error: "Nenhum flashcard para salvar." });
  if (deckId && newDeckName) return Promise.resolve({ success: false, error: "Destino de flashcards inválido." });

  return runSerializable(async (tx) => {
    let persistedDeckId = deckId;

    if (deckId) {
      const ownedDeck = await tx.deck.findFirst({ where: { id: deckId, userId }, select: { id: true } });
      if (!ownedDeck) return { success: false, error: "Grupo não encontrado." };
      await tx.flashcard.createMany({ data: cards.map((card) => ({ userId, frente: card.frente, verso: card.verso, deckId })) });
    } else {
      const deckName = newDeckName ?? `Gerado em ${now.toLocaleDateString("pt-BR")} às ${now.getHours()}:${now.getMinutes()}`;
      if (newDeckName) {
        const existing = await tx.deck.findFirst({
          where: { userId, nome: { equals: deckName, mode: "insensitive" } },
          select: { id: true },
        });
        if (existing) return { success: false, error: "Já existe um grupo com este nome!" };
      }

      const createdDeck = await tx.deck.create({
        data: { userId, nome: deckName, cards: { create: cards.map((card) => ({ userId, frente: card.frente, verso: card.verso })) } },
        select: { id: true },
      });
      persistedDeckId = createdDeck.id;
    }

    const requestedXp = Math.min(cards.length * XP_VALUES.CREATE_CARD, DAILY_LIMITS.MAX_XP_FROM_CREATION);
    const xpGained = await grantCreationXp(tx, userId, requestedXp, now);
    return { success: true, xpGained, deckId: persistedDeckId };
  });
}

export function recordReviewForUser(userId, cardId, evaluation, now = new Date()) {
  return runSerializable(async (tx) => {
    const card = await tx.flashcard.findUnique({ where: { id: cardId, userId } });
    if (!card) return { success: false };
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
    await tx.flashcard.update({ where: { id: cardId, userId }, data: { interval, repetition, easinessFactor, nextReview } });
    await grantXp(tx, userId, xpGained, "REVIEW");
    await processStreak(tx, userId, now);
    return { success: true, xpGained, isScheduledReview };
  });
}

export function completeTopicForUser(userId, topicId) {
  return runSerializable(async (tx) => {
    const topic = await tx.topic.findFirst({ where: { id: topicId, plan: { userId } }, select: { id: true, isCompleted: true } });
    if (!topic) return { success: false, error: "Tópico não encontrado" };
    if (topic.isCompleted) return { success: false, error: "Já concluído!" };
    await tx.topic.update({ where: { id: topicId }, data: { isCompleted: true } });
    await grantXp(tx, userId, XP_VALUES.COMPLETE_TOPIC, "COMPLETE_TOPIC");
    return { success: true };
  });
}

async function assertOwnedExamSource(tx, userId, sourceType, sourceId) {
  if (!EXAM_SOURCE_TYPES.has(sourceType)) return false;
  if (sourceType === "GLOBAL") return !sourceId;
  if (!sourceId) return false;
  if (sourceType === "DECK") return Boolean(await tx.deck.findFirst({ where: { id: sourceId, userId }, select: { id: true } }));
  if (sourceType === "TOPIC") return Boolean(await tx.topic.findFirst({ where: { id: sourceId, plan: { userId } }, select: { id: true } }));
  return Boolean(await tx.studyPlan.findFirst({ where: { id: sourceId, userId }, select: { id: true } }));
}

async function assertOwnedExamAnswers(tx, userId, answers) {
  if (!Array.isArray(answers) || answers.length === 0) return false;
  const ids = answers.map((answer) => answer.flashcardId);
  if (ids.some((id) => typeof id !== "string")) return false;
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length !== ids.length) return false;
  return await tx.flashcard.count({ where: { userId, id: { in: uniqueIds } } }) === uniqueIds.length;
}

function calculateExamXp(difficulty, correctAnswers, score) {
  let multiplier = XP_VALUES.EXAM_PER_CORRECT_EASY;
  if (difficulty === "MEDIUM") multiplier = XP_VALUES.EXAM_PER_CORRECT_MEDIUM;
  if (difficulty === "HARD") multiplier = XP_VALUES.EXAM_PER_CORRECT_HARD;
  if (difficulty === "IMPOSSIBLE") multiplier = XP_VALUES.EXAM_PER_CORRECT_IMPOSSIBLE;
  let amount = XP_VALUES.EXAM_COMPLETION + (correctAnswers * multiplier);
  if (score >= 0.9) amount += XP_VALUES.EXAM_PERFECT_BONUS;
  return amount;
}

export function finalizeExamForUser(userId, result, now = new Date()) {
  return runSerializable(async (tx) => {
    if (!EXAM_DIFFICULTIES.has(result.difficulty)) return { success: false, error: "Invalid exam difficulty." };
    if (!await assertOwnedExamSource(tx, userId, result.sourceType, result.sourceId)) return { success: false, error: "Invalid exam source." };
    if (!await assertOwnedExamAnswers(tx, userId, result.answers)) return { success: false, error: "Invalid exam answers." };
    const totalQuestions = result.answers.length;
    const correctAnswers = result.answers.filter((answer) => answer.isCorrect === true).length;
    const score = correctAnswers / totalQuestions;
    const sessionsToday = await tx.examSession.count({ where: { userId, createdAt: { gte: startOfLocalDay(now) } } });
    const limitReached = sessionsToday >= DAILY_EXAM_XP_LIMIT;
    const xpGained = limitReached ? 0 : calculateExamXp(result.difficulty, correctAnswers, score);
    const session = await tx.examSession.create({
      data: {
        userId,
        sourceType: result.sourceType,
        sourceDeckId: result.sourceType === "DECK" ? result.sourceId : undefined,
        sourceTopicId: result.sourceType === "TOPIC" ? result.sourceId : undefined,
        sourcePlanId: result.sourceType === "PLAN" ? result.sourceId : undefined,
        totalQuestions,
        correctAnswers,
        score,
        timeSpentSeconds: Math.max(0, Math.floor(Number(result.timeSpentSeconds) || 0)),
        difficulty: result.difficulty,
        xpAwarded: xpGained,
        createdAt: now,
        questions: { create: result.answers.map((answer) => ({ flashcardId: answer.flashcardId, isCorrect: answer.isCorrect === true, timeTakenSeconds: Math.max(0, Number(answer.timeTaken) || 0) })) },
      },
    });
    await grantXp(tx, userId, xpGained, "EXAM");
    if (!limitReached) await processStreak(tx, userId, now);
    return { success: true, sessionId: session.id, xpGained, score, limitReached };
  });
}
