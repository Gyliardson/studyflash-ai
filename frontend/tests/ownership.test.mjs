import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../lib/db.ts';

const userA = 'test-user-a';
const userB = 'test-user-b';

let deckA;
let deckB;
let planA;
let planB;
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

  planA = await prisma.studyPlan.create({
    data: {
      userId: userA,
      title: 'Plan A',
      difficulty: 'EASY',
      topics: { create: [{ title: 'Topic A', order: 1 }] },
    },
    include: { topics: true },
  });

  planB = await prisma.studyPlan.create({
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

function examData(overrides = {}) {
  return {
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
    ...overrides,
  };
}

async function assertNoExamWrites(operation) {
  const sessionsBefore = await prisma.examSession.count();
  const questionsBefore = await prisma.examQuestion.count();

  await assert.rejects(operation, /does not belong to the authenticated user/);

  assert.equal(await prisma.examSession.count(), sessionsBefore);
  assert.equal(await prisma.examQuestion.count(), questionsBefore);
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

test('rejects a mixed createMany batch without partially writing owned rows', async () => {
  const before = await prisma.flashcard.count({ where: { userId: userA } });

  await assert.rejects(
    () => prisma.flashcard.createMany({
      data: [
        { userId: userA, frente: 'Own row', verso: 'Must rollback', deckId: deckA.id },
        { userId: userA, frente: 'Foreign row', verso: 'Denied', deckId: deckB.id },
      ],
    }),
    /does not belong to the authenticated user/,
  );

  assert.equal(await prisma.flashcard.count({ where: { userId: userA } }), before);
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
  await assert.doesNotReject(() => prisma.examSession.create({ data: examData() }));
});

test('allows owned TOPIC and PLAN exam sources', async () => {
  await assert.doesNotReject(() => prisma.examSession.create({
    data: examData({ sourceType: 'TOPIC', sourceDeckId: undefined, sourceTopicId: topicA.id }),
  }));

  await assert.doesNotReject(() => prisma.examSession.create({
    data: examData({ sourceType: 'PLAN', sourceDeckId: undefined, sourcePlanId: planA.id }),
  }));
});

test('rejects another user DECK source without partial exam writes', async () => {
  await assertNoExamWrites(() => prisma.examSession.create({
    data: examData({ sourceDeckId: deckB.id }),
  }));
});

test('rejects another user TOPIC source without partial exam writes', async () => {
  await assertNoExamWrites(() => prisma.examSession.create({
    data: examData({ sourceType: 'TOPIC', sourceDeckId: undefined, sourceTopicId: topicB.id }),
  }));
});

test('rejects another user PLAN source without partial exam writes', async () => {
  await assertNoExamWrites(() => prisma.examSession.create({
    data: examData({ sourceType: 'PLAN', sourceDeckId: undefined, sourcePlanId: planB.id }),
  }));
});

test('rejects an exam referencing another user flashcard without partial writes', async () => {
  await assertNoExamWrites(() => prisma.examSession.create({
    data: examData({
      correctAnswers: 0,
      score: 0,
      questions: {
        create: [{ flashcardId: cardB.id, isCorrect: false, timeTakenSeconds: 10 }],
      },
    }),
  }));
});

test('rejects mixed owned and foreign flashcard IDs without partial writes', async () => {
  await assertNoExamWrites(() => prisma.examSession.create({
    data: examData({
      totalQuestions: 2,
      correctAnswers: 1,
      score: 0.5,
      questions: {
        create: [
          { flashcardId: cardA.id, isCorrect: true, timeTakenSeconds: 5 },
          { flashcardId: cardB.id, isCorrect: false, timeTakenSeconds: 5 },
        ],
      },
    }),
  }));
});

test('rejects duplicate flashcard IDs in one exam', async () => {
  await assertNoExamWrites(() => prisma.examSession.create({
    data: examData({
      totalQuestions: 2,
      correctAnswers: 2,
      questions: {
        create: [
          { flashcardId: cardA.id, isCorrect: true, timeTakenSeconds: 5 },
          { flashcardId: cardA.id, isCorrect: true, timeTakenSeconds: 5 },
        ],
      },
    }),
  }));
});

test('rejects GLOBAL with a source ID', async () => {
  await assertNoExamWrites(() => prisma.examSession.create({
    data: examData({ sourceType: 'GLOBAL', sourceDeckId: deckA.id }),
  }));
});

test('rejects DECK without a source ID', async () => {
  await assertNoExamWrites(() => prisma.examSession.create({
    data: examData({ sourceDeckId: undefined }),
  }));
});

test('rejects mixed source type/source ID combinations', async () => {
  await assertNoExamWrites(() => prisma.examSession.create({
    data: examData({ sourceTopicId: topicA.id }),
  }));
});
