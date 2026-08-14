import test, { after, beforeEach } from "node:test";
import assert from "node:assert/strict";

import prisma from "../lib/db.ts";
import { XP_VALUES } from "../lib/gamification.ts";
import { saveFlashcardsIdempotentForUser } from "../lib/content-creation-transactions.mjs";
import {
  createDeckForUser,
  mutationFingerprint,
  persistStudyPlanForUser,
  persistTopicCardsForUser,
} from "../lib/mutation-receipts.mjs";

const userA = "creation-idempotency-user-a";
const now = new Date("2026-08-14T12:00:00.000Z");

async function resetDatabase() {
  await prisma.mutationReceipt.deleteMany();
  await prisma.examQuestion.deleteMany();
  await prisma.examSession.deleteMany();
  await prisma.examAttemptQuestion.deleteMany();
  await prisma.examAttempt.deleteMany();
  await prisma.studySessionCard.deleteMany();
  await prisma.studySession.deleteMany();
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

test("sequential flashcard-save retry returns the canonical receipt without duplicate cards or XP", async () => {
  const deck = await prisma.deck.create({ data: { userId: userA, nome: "Retry deck" } });
  const cards = [{ frente: "Question", verso: "Answer" }];
  const requestKey = "save-retry-0001";

  const first = await saveFlashcardsIdempotentForUser(userA, cards, deck.id, undefined, requestKey, now);
  const retry = await saveFlashcardsIdempotentForUser(userA, cards, deck.id, undefined, requestKey, now);

  assert.equal(first.success, true);
  assert.deepEqual(retry, first);
  assert.equal(await prisma.flashcard.count({ where: { userId: userA, deckId: deck.id } }), 1);
  assert.equal(await prisma.mutationReceipt.count({ where: { userId: userA, kind: "SAVE_FLASHCARDS", requestKey } }), 1);
  assert.equal(await prisma.xPHistory.count({ where: { userId: userA, source: "CREATE_CARD" } }), 1);
  const profile = await prisma.userProfile.findUniqueOrThrow({ where: { userId: userA } });
  assert.equal(profile.xp, XP_VALUES.CREATE_CARD);
});

test("concurrent flashcard-save retry converges on one batch and one XP effect", async () => {
  const deck = await prisma.deck.create({ data: { userId: userA, nome: "Concurrent retry" } });
  const cards = [
    { frente: "Q1", verso: "A1" },
    { frente: "Q2", verso: "A2" },
  ];
  const requestKey = "save-concurrent-0001";

  const results = await Promise.all([
    saveFlashcardsIdempotentForUser(userA, cards, deck.id, undefined, requestKey, now),
    saveFlashcardsIdempotentForUser(userA, cards, deck.id, undefined, requestKey, now),
  ]);

  assert.equal(results.filter((result) => result.success).length, 2);
  assert.deepEqual(results[0], results[1]);
  assert.equal(await prisma.flashcard.count({ where: { userId: userA, deckId: deck.id } }), 2);
  assert.equal(await prisma.mutationReceipt.count({ where: { userId: userA, kind: "SAVE_FLASHCARDS" } }), 1);
  assert.equal(await prisma.xPHistory.count({ where: { userId: userA, source: "CREATE_CARD" } }), 1);
  const profile = await prisma.userProfile.findUniqueOrThrow({ where: { userId: userA } });
  assert.equal(profile.xp, 2 * XP_VALUES.CREATE_CARD);
});

test("reusing a flashcard request key for different content fails closed", async () => {
  const deck = await prisma.deck.create({ data: { userId: userA, nome: "Tamper retry" } });
  const requestKey = "save-tamper-0001";
  const first = await saveFlashcardsIdempotentForUser(userA, [{ frente: "Q1", verso: "A1" }], deck.id, undefined, requestKey, now);
  assert.equal(first.success, true);

  const tampered = await saveFlashcardsIdempotentForUser(userA, [{ frente: "Q2", verso: "A2" }], deck.id, undefined, requestKey, now);
  assert.equal(tampered.success, false);
  assert.match(tampered.error, /não corresponde/i);
  assert.equal(await prisma.flashcard.count({ where: { deckId: deck.id } }), 1);
  assert.equal(await prisma.xPHistory.count({ where: { userId: userA, source: "CREATE_CARD" } }), 1);
});

test("new deck names are atomic across different user intents while legacy lookup remains case-insensitive", async () => {
  const [first, second] = await Promise.all([
    createDeckForUser(userA, "Biologia", "deck-name-race-0001"),
    createDeckForUser(userA, "biologia", "deck-name-race-0002"),
  ]);

  assert.equal([first, second].filter((result) => result.success).length, 1);
  assert.equal([first, second].filter((result) => !result.success).length, 1);
  assert.equal(await prisma.deck.count({ where: { userId: userA } }), 1);
  const persisted = await prisma.deck.findFirstOrThrow({ where: { userId: userA } });
  assert.equal(persisted.nameKey, "biologia");
});

test("study-plan retry keeps the first committed AI result and rejects key reuse for another intent", async () => {
  const requestKey = "plan-retry-0001";
  const intentFingerprint = mutationFingerprint({ topic: "React", difficulty: "Iniciante" });
  const first = await persistStudyPlanForUser(userA, {
    title: "React path A",
    description: "First committed generation",
    difficulty: "Iniciante",
    topics: [{ title: "Hooks" }, { title: "State" }],
  }, requestKey, intentFingerprint);
  const retryWithDifferentAiOutput = await persistStudyPlanForUser(userA, {
    title: "React path B",
    description: "A retry must not replace committed AI output",
    difficulty: "Iniciante",
    topics: [{ title: "Different" }],
  }, requestKey, intentFingerprint);

  assert.equal(first.success, true);
  assert.deepEqual(retryWithDifferentAiOutput, first);
  assert.equal(await prisma.studyPlan.count({ where: { userId: userA } }), 1);
  assert.equal(await prisma.topic.count(), 2);

  const tamperedIntent = await persistStudyPlanForUser(userA, {
    title: "Vue",
    description: null,
    difficulty: "Avançado",
    topics: [{ title: "Composition API" }],
  }, requestKey, mutationFingerprint({ topic: "Vue", difficulty: "Avançado" }));
  assert.equal(tamperedIntent.success, false);
  assert.equal(await prisma.studyPlan.count({ where: { userId: userA } }), 1);
});

test("topic retry does not append twice but a new explicit request key can append a new batch", async () => {
  const plan = await prisma.studyPlan.create({
    data: {
      userId: userA,
      title: "Plan",
      difficulty: "Iniciante",
      topics: { create: [{ title: "Topic", order: 1 }] },
    },
    include: { topics: true },
  });
  const topicId = plan.topics[0].id;
  const requestKey = "topic-generation-0001";
  const firstBatch = [{ frente: "Q1", verso: "A1" }, { frente: "Q2", verso: "A2" }];

  const first = await persistTopicCardsForUser(userA, topicId, firstBatch, requestKey);
  const retry = await persistTopicCardsForUser(userA, topicId, firstBatch, requestKey);
  assert.equal(first.success, true);
  assert.deepEqual(retry, first);
  assert.equal(await prisma.flashcard.count({ where: { topicId } }), 2);

  const deliberateAppend = await persistTopicCardsForUser(
    userA,
    topicId,
    [{ frente: "Q3", verso: "A3" }],
    "topic-generation-0002",
  );
  assert.equal(deliberateAppend.success, true);
  assert.equal(await prisma.flashcard.count({ where: { topicId } }), 3);
  assert.equal(await prisma.mutationReceipt.count({ where: { userId: userA, kind: "GENERATE_TOPIC_CARDS" } }), 2);
});

test("topic persistence remains owner-scoped even with a valid-looking retry key", async () => {
  const foreignPlan = await prisma.studyPlan.create({
    data: {
      userId: "creation-idempotency-user-b",
      title: "Foreign",
      difficulty: "Iniciante",
      topics: { create: [{ title: "Foreign topic", order: 1 }] },
    },
    include: { topics: true },
  });

  const result = await persistTopicCardsForUser(
    userA,
    foreignPlan.topics[0].id,
    [{ frente: "No", verso: "Access" }],
    "topic-foreign-0001",
  );
  assert.equal(result.success, false);
  assert.equal(await prisma.flashcard.count(), 0);
  assert.equal(await prisma.mutationReceipt.count(), 0);
});
