"use server";

import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/db";

// Definindo o formato dos dados que vamos receber
type FlashcardInput = {
    frente: string;
    verso: string;
};

export async function salvarFlashcards(cards: FlashcardInput[]) {
    // 1. Quem é o usuário?
    const { userId } = await auth();

    if (!userId) {
        return { success: false, error: "Você precisa estar logado para salvar!" };
    }

    try {
        // 2. Salva no banco (Magia do Prisma)
        await prisma.flashcard.createMany({
            data: cards.map((card) => ({
                userId: userId,
                frente: card.frente,
                verso: card.verso,
                // deckId: null (Por enquanto salvamos sem deck, soltos na conta)
            })),
        });

        return { success: true };
    } catch (error) {
        console.error("Erro ao salvar:", error);
        return { success: false, error: "Erro ao conectar com o banco de dados." };
    }
}

// --- LISTAR ---
export async function listarMinhaColecao() {
    const { userId } = await auth();

    if (!userId) return [];

    try {
        const cards = await prisma.flashcard.findMany({
            where: { userId: userId },
            orderBy: { createdAt: 'desc' }, // Mais recentes primeiro
        });
        return cards;
    } catch (error) {
        console.error("Erro ao listar:", error);
        return [];
    }
}