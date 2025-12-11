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

// --- 7. BUSCAR PARA REVISÃO (Atualizado v0.3.0) ---
export async function buscarCartoesParaRevisar(
    modoExtra: boolean = false, 
    deckIds: string[] = [], 
    planId?: string, 
    topicId?: string
) {
    const { userId } = await auth();
    if (!userId) return [];

    try {
        const now = new Date();
        const whereCondition: any = { userId: userId };

        // --- LÓGICA DE FILTRO HÍBRIDA ---
        
        // 1. Filtro por Tópico Único
        if (topicId) {
            whereCondition.topicId = topicId;
        } 
        // 2. Filtro por Plano Completo (Todos os tópicos do plano)
        else if (planId) {
            whereCondition.topic = { planId: planId };
        }
        // 3. Filtro por Decks Selecionados
        else if (deckIds && deckIds.length > 0) {
            whereCondition.deckId = { in: deckIds };
        }
        // 4. Modo Global (Se nada for passado, pega TUDO: Decks + Trilhas)
        // Não adicionamos filtro específico, apenas userId.

        // --- FILTRO SRS (Data) ---
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

// --- 9. CONTAGEM TOTAL (Atualizado v0.3.0) ---
export async function contarTotalFlashcards(deckIds: string[] = [], planId?: string, topicId?: string) {
    const { userId } = await auth();
    if (!userId) return 0;
    try {
        const whereCondition: any = { userId };

        if (topicId) {
            whereCondition.topicId = topicId;
        } else if (planId) {
            whereCondition.topic = { planId: planId };
        } else if (deckIds && deckIds.length > 0) {
            whereCondition.deckId = { in: deckIds };
        }

        return await prisma.flashcard.count({ where: whereCondition });
    } catch (error) {
        return 0;
    }
}

// 10. GERAR E SALVAR PLANO DE ESTUDO
export async function gerarSalvarPlano(tema: string, dificuldade: string) {
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Login necessário para criar planos." };

    try {
        // 1. Chama a IA no Backend Python
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
        
        const response = await fetch(`${baseUrl}/api/gerar-plano`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tema, dificuldade }),
            cache: "no-store" // Garante que não cacheie a resposta
        });

        if (!response.ok) throw new Error("Erro ao comunicar com o Tutor IA.");

        const planoIA = await response.json();

        // 2. Salva no Banco (Plano + Tópicos em uma transação)
        const novoPlano = await prisma.studyPlan.create({
            data: {
                userId,
                title: planoIA.titulo,
                description: planoIA.descricao,
                difficulty: planoIA.dificuldade,
                topics: {
                    create: planoIA.topicos.map((t: any, index: number) => ({
                        title: t.titulo,
                        order: index + 1
                    }))
                }
            },
            include: { topics: true } // Retorna já com os tópicos criados
        });

        return { success: true, planoId: novoPlano.id };

    } catch (error) {
        console.error("Erro ao gerar plano:", error);
        return { success: false, error: "Falha ao criar o plano de estudos." };
    }
}

// 11. LISTAR MEUS PLANOS
export async function listarMeusPlanos() {
    const { userId } = await auth();
    if (!userId) return [];

    try {
        return await prisma.studyPlan.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            include: { 
                topics: { 
                    orderBy: { order: 'asc' } 
                } 
            }
        });
    } catch (error) {
        return [];
    }
}

// 12. BUSCAR DETALHES DO PLANO
export async function buscarPlanoPorId(id: string) {
    const { userId } = await auth();
    if (!userId) return null;

    return await prisma.studyPlan.findUnique({
        where: { id, userId },
        include: { 
            topics: { 
                orderBy: { order: 'asc' },
                include: { _count: { select: { cards: true } } }
            } 
        }
    });
}

// 13. GERAR CARDS PARA UM TÓPICO ESPECÍFICO
export async function gerarCardsParaTopico(planTitle: string, topicId: string, topicTitle: string) {
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Não autorizado" };

    try {
        // 1. Chama a IA
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
        const res = await fetch(`${baseUrl}/api/gerar-cards-topico`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tema_plano: planTitle, titulo_topico: topicTitle }),
            cache: "no-store"
        });

        if (!res.ok) throw new Error("Falha na IA");
        const data = await res.json();

        // 2. Salva no Banco vinculando ao Tópico
        await prisma.flashcard.createMany({
            data: data.cartoes.map((c: any) => ({
                userId,
                frente: c.frente,
                verso: c.verso,
                topicId: topicId // VÍNCULO IMPORTANTE
            }))
        });

        return { success: true };
    } catch (error) {
        console.error("Erro ao gerar cards do tópico:", error);
        return { success: false, error: "Erro ao gerar conteúdo." };
    }
}

// 14. EXCLUIR PLANO DE ESTUDO
export async function excluirPlano(id: string) {
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Não autorizado" };

    try {
        await prisma.studyPlan.delete({
            where: { id, userId },
        });
        return { success: true };
    } catch (error) {
        console.error("Erro ao excluir plano:", error);
        return { success: false, error: "Erro ao excluir plano." };
    }
}