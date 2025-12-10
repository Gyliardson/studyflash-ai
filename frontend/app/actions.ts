"use server";

import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/db";

// --- TIPOS ---
type FlashcardInput = {
    frente: string;
    verso: string;
};

// --- 1. CRIAR UM NOVO BARALHO (COM VALIDAÇÃO DE DUPLICIDADE) ---
export async function criarBaralho(nome: string) {
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Logue para criar grupos." };

    try {
        // 1. Verifica se já existe um deck com esse nome PARA ESSE USUÁRIO
        const existente = await prisma.deck.findFirst({
            where: {
                userId,
                nome: {
                    equals: nome,
                    mode: 'insensitive' // Ignora maiúsculas/minúsculas (Inglês == inglês)
                }
            }
        });

        if (existente) {
            return { success: false, error: "Você já tem um grupo com este nome!" };
        }

        // 2. Se não existe, cria
        const deck = await prisma.deck.create({
            data: {
                userId,
                nome,
            },
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
        const decks = await prisma.deck.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: { cards: true } // Já traz a contagem de cards dentro!
                }
            }
        });
        return decks;
    } catch (error) {
        return [];
    }
}

// --- 3. SALVAR FLASHCARDS (Agora com suporte a Deck) ---
export async function salvarFlashcards(cards: FlashcardInput[], deckId?: string) {
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Você precisa estar logado!" };

    try {
        // Se o usuário não escolheu deck, salvamos "solto" (deckId null)
        // Mas o ideal é forçar a escolher. Vamos deixar opcional por enquanto.

        await prisma.flashcard.createMany({
            data: cards.map((card) => ({
                userId: userId,
                frente: card.frente,
                verso: card.verso,
                deckId: deckId || null, // Liga ao baralho se tiver ID
            })),
        });

        return { success: true };
    } catch (error) {
        console.error("Erro ao salvar:", error);
        return { success: false, error: "Erro ao conectar com o banco." };
    }
}

// --- 4. LISTAR CARDS DE UM BARALHO ESPECÍFICO ---
export async function listarCardsDoBaralho(deckId: string) {
    const { userId } = await auth();
    if (!userId) return [];

    try {
        const cards = await prisma.flashcard.findMany({
            where: {
                userId,
                deckId // Filtra pelo ID do baralho
            },
            orderBy: { createdAt: 'desc' },
        });
        return cards;
    } catch (error) {
        return [];
    }
}

// --- 5. EXCLUIR UM BARALHO (E seus cards opcionalmente) ---
export async function excluirBaralho(id: string) {
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Não autorizado" };

    try {
        // Opcional: Se quiser apagar os cards junto, descomente a linha abaixo.
        // Se deixar comentado, os cards ficam "órfãos" (sem deckId) mas continuam no banco.
        // await prisma.flashcard.deleteMany({ where: { deckId: id, userId } });

        await prisma.deck.delete({
            where: { id, userId }, // Garante que só apaga se for dono
        });
        return { success: true };
    } catch (error) {
        console.error("Erro ao excluir deck:", error);
        return { success: false, error: "Erro ao excluir." };
    }
}

// --- 6. EXCLUIR UM FLASHCARD ÚNICO ---
export async function excluirFlashcard(id: string) {
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Não autorizado" };

    try {
        await prisma.flashcard.delete({
            where: { id, userId },
        });
        return { success: true };
    } catch (error) {
        return { success: false, error: "Erro ao excluir card." };
    }
}