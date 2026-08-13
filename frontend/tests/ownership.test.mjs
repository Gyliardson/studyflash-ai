import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../lib/db.ts';

const userA = 'test-user-a';
const userB = 'test-user-b';

let deckA;
let deckB;
let topicA;
let topicB;
let cardA;
let cardB;

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

async function seedOwnershipFixtures() {
  await resetDatabase();

  deckA = await prisma.deck.create({ data: { userId: userA, nome: 'Deck A' } });
  deckB = await prisma.deck.create({ data: { userId: userB, nome: 'Deck B' } });

  const planA = await prisma.studyPlan.create({
    data: {
      userId: userA,
      title: 'Plan A',
      difficulty: 'EASY',
      topics: { create: [{ title: 'Topic A', order: 1 }] },
    },
    include: { topics: true },
  });

  const planB = await prisma.studyPlan.create({
    data: {
      userId: userB,
      title: 'Plan B',
      difficulty: 'EASY',
      topics: { create: [{ title: 'Topic B', order: 1 }] },
    },
    include: { topics: true },
  });

  topicA = planA.topics[0];
  topicB = planB.topics[0];

  cardA = await prisma.flashcard.create({
    data: { userId: userA, frente: 'A?', verso: 'A!' },
  });
  cardB = await prisma.flashcard.create({
    data: { userId: userB, frente: 'B?', verso: 'B!' },
  });
}

await seedOwnershipFixtures();

after(async () => {
  await resetDatabase();
  await prisma.$disconnect();
});

test('allows creating flashcards inside an owned deck', async () => {
  await assert.doesNotReject(() => prisma.flashcard.createMany({
    data: [{ userId: userA, frente: 'Own deck', verso: 'Allowed', deckId: deckA.id }],
  }));
});

test('rejects creating flashcards inside another user deck', async () => {
  await assert.rejects(
    () => prisma.flashcard.createMany({
      data: [{ userId: userA, frente: 'Foreign deck', verso: 'Denied', deckId: deckB.id }],
    }),
    /does not belong to the authenticated user/,
  );
});

test('allows creating flashcards inside an owned topic', async () => {
  await assert.doesNotReject(() => prisma.flashcard.createMany({
    data: [{ userId: userA, frente: 'Own topic', verso: 'Allowed', topicId: topicA.id }],
  }));
});

test('rejects creating flashcards inside another user topic', async () => {
  await assert.rejects(
    () => prisma.flashcard.createMany({
      data: [{ userId: userA, frente: 'Foreign topic', verso: 'Denied', topicId: topicB.id }],
    }),
    /does not belong to the authenticated user/,
  );
});

test('allows an exam referencing only the user own source and cards', async () => {
  await assert.doesNotReject(() => prisma.examSession.create({
    data: {
      userId: userA,
      sourceType: 'DECK',
      sourceDeckId: deckA.id,
      totalQuestions: 1,
      correctAnswers: 1,
      score: 1,
      timeSpentSeconds: 10,
      difficulty: 'EASY',
      xpAwarded: 0,
      questions: {
        create: [{ flashcardId: cardA.id, isCorrect: true, timeTakenSeconds: 10 }],
      },
    },
  }));
});

test('rejects an exam using another user source', async () => {
  await assert.rejects(
    () => prisma.examSession.create({
      data: {
        userId: userA,
        sourceType: 'DECK',
        sourceDeckId: deckB.id,
        totalQuestions: 1,
        correctAnswers: 1,
        score: 1,
        timeSpentSeconds: 10,
        difficulty: 'EASY',
        xpAwarded: 0,
        questions: {
          create: [{ flashcardId: cardA.id, isCorrect: true, timeTakenSeconds: 10 }],
        },
      },
    }),
    /does not belong to the authenticated user/,
  );
});

test('rejects an exam referencing another user flashcard', async () => {
  await assert.rejects(
    () => prisma.examSession.create({
      data: {
        userId: userA,
        sourceType: 'DECK',
        sourceDeckId: deckA.id,
        totalQuestions: 1,
        correctAnswers: 0,
        score: 0,
        timeSpentSeconds: 10,
        difficulty: 'EASY',
        xpAwarded: 0,
        questions: {
          create: [{ flashcardId: cardB.id, isCorrect: false, timeTakenSeconds: 10 }],
        },
      },
    }),
    /does not belong to the authenticated user/,
  );
});

test('rejects malformed source type/source id combinations', async () => {
  await assert.rejects(
    () => prisma.examSession.create({
      data: {
        userId: userA,
        sourceType: 'GLOBAL',
        sourceDeckId: deckA.id,
        totalQuestions: 1,
        correctAnswers: 1,
        score: 1,
        timeSpentSeconds: 10,
        difficulty: 'EASY',
        xpAwarded: 0,
        questions: {
          create: [{ flashcardId: cardA.id, isCorrect: true, timeTakenSeconds: 10 }],
        },
      },
    }),
    /does not belong to the authenticated user/,
  );
});
