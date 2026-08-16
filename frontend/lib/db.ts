import { Prisma, PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const AUTHORIZATION_ERROR = 'Resource does not belong to the authenticated user.';

const prismaClientSingleton = () => {
    const connectionString = process.env.DATABASE_URL;

    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    const baseClient = new PrismaClient({ adapter });

    const assertOwnedFlashcardRelations = async (rows: Prisma.FlashcardCreateManyInput[]) => {
        for (const row of rows) {
            if (row.deckId) {
                const ownedDeck = await baseClient.deck.findFirst({
                    where: { id: row.deckId, userId: row.userId },
                    select: { id: true },
                });

                if (!ownedDeck) throw new Error(AUTHORIZATION_ERROR);
            }

            if (row.topicId) {
                const ownedTopic = await baseClient.topic.findFirst({
                    where: {
                        id: row.topicId,
                        plan: { userId: row.userId },
                    },
                    select: { id: true },
                });

                if (!ownedTopic) throw new Error(AUTHORIZATION_ERROR);
            }
        }
    };

    const assertOwnedExamSource = async (data: Prisma.ExamSessionUncheckedCreateInput) => {
        const sourceIds = [data.sourceDeckId, data.sourceTopicId, data.sourcePlanId].filter(Boolean);

        switch (data.sourceType) {
            case 'GLOBAL':
                if (sourceIds.length !== 0) throw new Error(AUTHORIZATION_ERROR);
                return;
            case 'DECK': {
                if (!data.sourceDeckId || sourceIds.length !== 1) throw new Error(AUTHORIZATION_ERROR);
                const owned = await baseClient.deck.findFirst({
                    where: { id: data.sourceDeckId, userId: data.userId },
                    select: { id: true },
                });
                if (!owned) throw new Error(AUTHORIZATION_ERROR);
                return;
            }
            case 'TOPIC': {
                if (!data.sourceTopicId || sourceIds.length !== 1) throw new Error(AUTHORIZATION_ERROR);
                const owned = await baseClient.topic.findFirst({
                    where: { id: data.sourceTopicId, plan: { userId: data.userId } },
                    select: { id: true },
                });
                if (!owned) throw new Error(AUTHORIZATION_ERROR);
                return;
            }
            case 'PLAN': {
                if (!data.sourcePlanId || sourceIds.length !== 1) throw new Error(AUTHORIZATION_ERROR);
                const owned = await baseClient.studyPlan.findFirst({
                    where: { id: data.sourcePlanId, userId: data.userId },
                    select: { id: true },
                });
                if (!owned) throw new Error(AUTHORIZATION_ERROR);
                return;
            }
            default:
                throw new Error(AUTHORIZATION_ERROR);
        }
    };

    const assertOwnedExamQuestions = async (data: Prisma.ExamSessionUncheckedCreateInput) => {
        const questions = data.questions?.create;
        if (!questions) return;

        const rows = Array.isArray(questions) ? questions : [questions];
        const flashcardIds = rows.map((row) => {
            if (!('flashcardId' in row) || typeof row.flashcardId !== 'string') {
                throw new Error(AUTHORIZATION_ERROR);
            }
            return row.flashcardId;
        });
        const uniqueIds = [...new Set(flashcardIds)];

        if (uniqueIds.length !== flashcardIds.length) throw new Error(AUTHORIZATION_ERROR);

        const ownedCount = await baseClient.flashcard.count({
            where: {
                userId: data.userId,
                id: { in: uniqueIds },
            },
        });

        if (ownedCount !== uniqueIds.length) throw new Error(AUTHORIZATION_ERROR);
    };

    return baseClient.$extends({
        query: {
            flashcard: {
                async createMany({ args, query }) {
                    const rows = Array.isArray(args.data) ? args.data : [args.data];
                    await assertOwnedFlashcardRelations(rows);
                    return query(args);
                },
            },
            examSession: {
                async create({ args, query }) {
                    const data = args.data as Prisma.ExamSessionUncheckedCreateInput;
                    await assertOwnedExamSource(data);
                    await assertOwnedExamQuestions(data);
                    return query(args);
                },
            },
        },
    });
};

declare global {
    var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma;
