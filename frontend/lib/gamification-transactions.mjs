import { Prisma } from "@prisma/client";
import prisma from "./db.ts";
import { DAILY_LIMITS, XP_VALUES } from "./gamification.ts";

const MAX_SERIALIZABLE_ATTEMPTS = 5;
const DAILY_EXAM_XP_LIMIT = 3;
const EXAM_ATTEMPT_TTL_MS = 2 * 60 * 60 * 1000;
const EXAM_DIFFICULTIES = new Set(["EASY", "MEDIUM", "HARD", "IMPOSSIBLE"]);
const EXAM_SOURCE_TYPES = new Set(["DECK", "TOPIC", "PLAN", "GLOBAL"]);

function isRetryableTransactionConflict(error) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code === "P2034") return true;
  if (error.code !== "P2002") return false;
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
        const existing = await tx.deck.findFirst({ where: { userId, nome: { equals: deckName, mode: "insensitive" } }, select: { id: true } });
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

function validateAttemptQuestions(questions) {
  if (!Array.isArray(questions) || questions.length === 0) return false;
  const ids = questions.map((question) => question.flashcardId);
  if (ids.some((id) => typeof id !== "string" || !id)) return false;
  if (new Set(ids).size !== ids.length) return false;
  return questions.every((question) => {
    if (typeof question.prompt !== "string" || question.prompt.length === 0) return false;
    if (typeof question.expectedAnswer !== "string" || question.expectedAnswer.length === 0) return false;
    if (!Array.isArray(question.options) || question.options.length < 2 || question.options.length > 6) return false;
    if (!question.options.every((option) => typeof option === "string" && option.length > 0)) return false;
    if (new Set(question.options).size !== question.options.length) return false;
    return question.options.includes(question.expectedAnswer);
  });
}

export function createExamAttemptForUser(userId, input, now = new Date()) {
  return runSerializable(async (tx) => {
    if (!EXAM_DIFFICULTIES.has(input.difficulty)) return { success: false, error: "Invalid exam difficulty." };
    if (!await assertOwnedExamSource(tx, userId, input.sourceType, input.sourceId)) return { success: false, error: "Invalid exam source." };
    if (!validateAttemptQuestions(input.questions)) return { success: false, error: "Invalid exam questions." };
    const ids = input.questions.map((question) => question.flashcardId);
    const ownedCount = await tx.flashcard.count({ where: { userId, id: { in: ids } } });
    if (ownedCount !== ids.length) return { success: false, error: "Invalid exam questions." };
    const expiresAt = new Date(now.getTime() + EXAM_ATTEMPT_TTL_MS);
    const attempt = await tx.examAttempt.create({
      data: {
        userId,
        sourceType: input.sourceType,
        sourceDeckId: input.sourceType === "DECK" ? input.sourceId : undefined,
        sourceTopicId: input.sourceType === "TOPIC" ? input.sourceId : undefined,
        sourcePlanId: input.sourceType === "PLAN" ? input.sourceId : undefined,
        difficulty: input.difficulty,
        expiresAt,
        createdAt: now,
        questions: { create: input.questions.map((question, order) => ({ flashcardId: question.flashcardId, prompt: question.prompt, expectedAnswer: question.expectedAnswer, options: question.options, order })) },
      },
    });
    return { success: true, attemptId: attempt.id, expiresAt };
  });
}

function validateAttemptAnswers(questions, answers) {
  if (!Array.isArray(answers) || answers.length !== questions.length) return false;
  const ids = answers.map((answer) => answer?.flashcardId);
  if (ids.some((id) => typeof id !== "string" || !id)) return false;
  if (new Set(ids).size !== ids.length) return false;
  const questionByCard = new Map(questions.map((question) => [question.flashcardId, question]));
  return answers.every((answer) => {
    const question = questionByCard.get(answer.flashcardId);
    if (!question) return false;
    if (typeof answer.timeTaken !== "number" || !Number.isFinite(answer.timeTaken) || answer.timeTaken < 0) return false;
    if (answer.selectedOption === null) return true;
    if (typeof answer.selectedOption !== "string") return false;
    const options = Array.isArray(question.options) ? question.options : [];
    return options.includes(answer.selectedOption);
  });
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
    if (typeof result.attemptId !== "string" || !result.attemptId) return { success: false, error: "Invalid exam attempt." };
    const attempt = await tx.examAttempt.findFirst({ where: { id: result.attemptId, userId }, include: { questions: { orderBy: { order: "asc" } } } });
    if (!attempt) return { success: false, error: "Invalid exam attempt." };
    if (attempt.status !== "ACTIVE") return { success: false, error: "Exam attempt already finalized." };
    if (attempt.expiresAt <= now) {
      await tx.examAttempt.updateMany({ where: { id: attempt.id, userId, status: "ACTIVE" }, data: { status: "EXPIRED" } });
      return { success: false, error: "Exam attempt expired." };
    }
    if (!validateAttemptAnswers(attempt.questions, result.answers)) return { success: false, error: "Invalid exam answers." };
    const claimed = await tx.examAttempt.updateMany({ where: { id: attempt.id, userId, status: "ACTIVE" }, data: { status: "COMPLETED", finalizedAt: now } });
    if (claimed.count !== 1) return { success: false, error: "Exam attempt already finalized." };
    const answerByCard = new Map(result.answers.map((answer) => [answer.flashcardId, answer]));
    const evaluated = attempt.questions.map((question) => {
      const answer = answerByCard.get(question.flashcardId);
      return { flashcardId: question.flashcardId, isCorrect: answer?.selectedOption === question.expectedAnswer, timeTakenSeconds: Math.max(0, answer?.timeTaken ?? 0) };
    });
    const totalQuestions = attempt.questions.length;
    const correctAnswers = evaluated.filter((answer) => answer.isCorrect).length;
    const score = correctAnswers / totalQuestions;
    const sessionsToday = await tx.examSession.count({ where: { userId, createdAt: { gte: startOfLocalDay(now) } } });
    const limitReached = sessionsToday >= DAILY_EXAM_XP_LIMIT;
    const xpGained = limitReached ? 0 : calculateExamXp(attempt.difficulty, correctAnswers, score);
    const session = await tx.examSession.create({
      data: {
        userId,
        attemptId: attempt.id,
        sourceType: attempt.sourceType,
        sourceDeckId: attempt.sourceDeckId,
        sourceTopicId: attempt.sourceTopicId,
        sourcePlanId: attempt.sourcePlanId,
        totalQuestions,
        correctAnswers,
        score,
        timeSpentSeconds: Math.max(0, Math.floor(Number(result.timeSpentSeconds) || 0)),
        difficulty: attempt.difficulty,
        xpAwarded: xpGained,
        createdAt: now,
        questions: { create: evaluated },
      },
    });
    await grantXp(tx, userId, xpGained, "EXAM");
    if (!limitReached) await processStreak(tx, userId, now);
    return {
      success: true,
      sessionId: session.id,
      xpGained,
      score,
      correctAnswers,
      totalQuestions,
      difficulty: attempt.difficulty,
      sourceType: attempt.sourceType,
      sourceId: attempt.sourceDeckId ?? attempt.sourceTopicId ?? attempt.sourcePlanId ?? undefined,
      limitReached,
    };
  });
}
