"use server";

import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/db";

// --- TIPOS ---
type FlashcardInput = {
    frente: string;
    verso: string;
};

// --- 1. CRIAR UM NOVO BARALHO ---
export async function criarBaralho(nome: string) {
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Logue para criar grupos." };

    try {
        const existente = await prisma.deck.findFirst({
            where: {
                userId,
                nome: { equals: nome, mode: 'insensitive' }
            }
        });

        if (existente) return { success: false, error: "Já existe um grupo com este nome!" };

        const deck = await prisma.deck.create({
            data: { userId, nome },
        });
        return { success: true, deck };
    } catch (error) {
        console.error("Erro ao criar deck:", error);
        return { success: false, error: "Erro ao criar grupo." };
    }
}

// --- 2. LISTAR MEUS BARALHOS ---
export async function listarMeusBaralhos() {
    const { userId } = await auth();
    if (!userId) return [];

    try {
        return await prisma.deck.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            include: {
                _count: { select: { cards: true } }
            }
        });
    } catch (error) {
        return [];
    }
}

// --- 3. SALVAR FLASHCARDS ---
export async function salvarFlashcards(cards: FlashcardInput[], deckId?: string) {
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Login necessário." };

    try {
        if (deckId) {
            await prisma.flashcard.createMany({
                data: cards.map((card) => ({
                    userId,
                    frente: card.frente,
                    verso: card.verso,
                    deckId
                })),
            });
        } else {
            const nomeBaralho = `Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().getHours()}:${new Date().getMinutes()}`;

            await prisma.deck.create({
                data: {
                    userId,
                    nome: nomeBaralho,
                    cards: {
                        create: cards.map(c => ({
                            userId,
                            frente: c.frente,
                            verso: c.verso
                        }))
                    }
                }
            });
        }

        return { success: true };
    } catch (error) {
        console.error("Erro ao salvar:", error);
        return { success: false, error: "Falha ao salvar no banco." };
    }
}

// --- 4. LISTAR CARDS DE UM BARALHO ---
export async function listarCardsDoBaralho(deckId: string) {
    const { userId } = await auth();
    if (!userId) return [];

    try {
        return await prisma.flashcard.findMany({
            where: { userId, deckId },
            orderBy: { createdAt: 'desc' },
        });
    } catch (error) {
        return [];
    }
}

// --- 5. EXCLUIR BARALHO ---
export async function excluirBaralho(id: string) {
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Não autorizado" };

    try {
        await prisma.deck.delete({
            where: { id, userId },
        });
        return { success: true };
    } catch (error) {
        console.error("Erro ao excluir:", error);
        return { success: false, error: "Erro ao excluir." };
    }
}

// --- 6. EXCLUIR FLASHCARD ---
export async function excluirFlashcard(id: string) {
    const { userId } = await auth();
    if (!userId) return { success: false };

    try {
        await prisma.flashcard.delete({ where: { id, userId } });
        return { success: true };
    } catch (error) {
        return { success: false };
    }
}

// --- 7. BUSCAR PARA REVISÃO ---
export async function buscarCartoesParaRevisar(modoExtra: boolean = false, deckIds: string[] = []) {
    const { userId } = await auth();
    if (!userId) return [];

    try {
        const now = new Date();
        const whereCondition: any = { userId: userId };

        // Filtro de Decks (Se tiver IDs na lista, filtra. Se vazio, pega tudo).
        if (deckIds && deckIds.length > 0) {
            whereCondition.deckId = { in: deckIds };
        }

        // Filtro de Data (SRS)
        if (!modoExtra) {
            whereCondition.nextReview = { lte: now };
        }

        return await prisma.flashcard.findMany({
            where: whereCondition,
            orderBy: { nextReview: 'asc' },
            take: 20
        });
    } catch (error) {
        console.error("Erro ao buscar revisões:", error);
        return [];
    }
}

// --- 8. REGISTRAR PROGRESSO ---
export async function registrarRevisao(cardId: string, avaliacao: 'errei' | 'dificil' | 'facil') {
    const { userId } = await auth();
    if (!userId) return { success: false };

    try {
        const card = await prisma.flashcard.findUnique({
            where: { id: cardId, userId: userId }
        });

        if (!card) return { success: false };

        let { interval, repetition, easinessFactor: ef } = card;

        if (avaliacao === 'errei') {
            repetition = 0;
            interval = 1;
        } else {
            if (avaliacao === 'dificil') ef = Math.max(1.3, ef - 0.15);
            else ef = ef + 0.15;

            repetition += 1;
            if (repetition === 1) interval = 1;
            else if (repetition === 2) interval = 6;
            else interval = Math.round(interval * ef);
        }

        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + interval);

        await prisma.flashcard.update({
            where: { id: cardId },
            data: { interval, repetition, easinessFactor: ef, nextReview: nextDate }
        });

        return { success: true };
    } catch (error) {
        return { success: false };
    }
}

// --- 9. CONTAGEM TOTAL (FILTRADA) ---
export async function contarTotalFlashcards(deckIds: string[] = []) {
    const { userId } = await auth();
    if (!userId) return 0;
    try {
        const whereCondition: any = { userId };
        if (deckIds && deckIds.length > 0) {
            whereCondition.deckId = { in: deckIds };
        }
        return await prisma.flashcard.count({ where: whereCondition });
    } catch (error) {
        return 0;
    }
}