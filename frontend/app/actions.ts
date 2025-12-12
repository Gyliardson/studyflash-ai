"use server";

import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/db";
import { XP_VALUES } from "@/lib/gamification";

// --- TIPOS ---
type FlashcardInput = {
    frente: string;
    verso: string;
};

// Função interna para dar XP ao usuário
// Adicionei o parâmetro opcional 'source' para logs futuros, sem quebrar o código atual
async function concederXp(userId: string, amount: number, source: string = "UNKNOWN") {
    if (amount <= 0) return;

    try {
        await prisma.userProfile.upsert({
            where: { userId },
            create: { userId, xp: amount, weeklyXp: amount }, // Agora vai funcionar com o schema corrigido
            update: { 
                xp: { increment: amount },
                weeklyXp: { increment: amount }
            }
        });
    } catch (error) {
        console.error("Erro ao conceder XP:", error);
    }
}

// Função interna para gerenciar a Ofensiva (Streak)
async function processarStreak(userId: string) {
    try {
        const profile = await prisma.userProfile.findUnique({ where: { userId } });
        
        // Se não tiver perfil ainda, cria na primeira interação e retorna
        if (!profile) {
             await prisma.userProfile.create({
                data: { 
                    userId, 
                    currentStreak: 1, 
                    longestStreak: 1, 
                    lastStudyDate: new Date(),
                    xp: 0,
                    weeklyXp: 0 
                }
            });
            return { streakBonus: false };
        }

        const hoje = new Date();
        const ultimaData = profile.lastStudyDate ? new Date(profile.lastStudyDate) : null;
        
        // Zera as horas para comparar apenas os dias (Meia-noite)
        const hojeZero = new Date(hoje.setHours(0,0,0,0));
        const ultimaZero = ultimaData ? new Date(ultimaData.setHours(0,0,0,0)) : null;

        // Se nunca estudou antes (caso de migração de usuário antigo sem data)
        if (!ultimaZero) {
            await prisma.userProfile.update({
                where: { userId },
                data: { currentStreak: 1, longestStreak: 1, lastStudyDate: new Date() }
            });
            return { streakBonus: false };
        }

        const diffTime = Math.abs(hojeZero.getTime() - ultimaZero.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

        if (diffDays === 0) {
            // Já estudou hoje, não faz nada
            return { streakBonus: false };
        } else if (diffDays === 1) {
            // Estudou ontem -> Aumenta a Streak!
            await prisma.userProfile.update({
                where: { userId },
                data: { 
                    currentStreak: { increment: 1 },
                    lastStudyDate: new Date(),
                    longestStreak: Math.max(profile.currentStreak + 1, profile.longestStreak)
                }
            });
            // Dá o bônus de XP
            await concederXp(userId, XP_VALUES.DAILY_STREAK_BONUS, "STREAK");
            return { streakBonus: true };
        } else {
            // Passou mais de 1 dia -> Zerou a Streak :(
            await prisma.userProfile.update({
                where: { userId },
                data: { currentStreak: 1, lastStudyDate: new Date() }
            });
            return { streakBonus: false };
        }
    } catch (error) {
        console.error("Erro no streak:", error);
        return { streakBonus: false };
    }
}

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

// --- 3. SALVAR FLASHCARDS (ATUALIZADA COM XP) ---
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

        // === CORREÇÃO: DAR XP PELA CRIAÇÃO ===
        // Limitamos a 50 XP por lote
        const xpGanho = Math.min(cards.length * XP_VALUES.CREATE_CARD, 50);
        await concederXp(userId, xpGanho);

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

// --- 8. REGISTRAR PROGRESSO (COM XP + ANTI-FARM) ---
export async function registrarRevisao(cardId: string, avaliacao: 'errei' | 'dificil' | 'facil') {
    const { userId } = await auth();
    if (!userId) return { success: false };

    try {
        const card = await prisma.flashcard.findUnique({
            where: { id: cardId, userId: userId }
        });

        if (!card) return { success: false };

        // 1. Regra Anti-Farm: Só ganha XP se a revisão for agendada (vencida)
        const isScheduledReview = card.nextReview <= new Date();
        
        let xpGained = 0;

        if (isScheduledReview) {
            if (avaliacao === 'facil') xpGained = XP_VALUES.REVIEW_EASY;
            else if (avaliacao === 'dificil') xpGained = XP_VALUES.REVIEW_HARD;
            else xpGained = XP_VALUES.REVIEW_FAIL;
        } else {
            xpGained = XP_VALUES.REVIEW_EXTRA; // 0 XP
        }

        // 2. Lógica SRS
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

        // 3. Transação Atômica (Card + XP)
        await prisma.$transaction(async (tx) => {
            await tx.flashcard.update({
                where: { id: cardId },
                data: { interval, repetition, easinessFactor: ef, nextReview: nextDate }
            });

            if (xpGained > 0) {
                // === ATENÇÃO: Se der erro de 'weeklyXp' aqui, verifique seu schema.prisma ===
                await tx.userProfile.upsert({
                    where: { userId },
                    create: { userId, xp: xpGained, weeklyXp: xpGained },
                    update: { 
                        xp: { increment: xpGained },
                        weeklyXp: { increment: xpGained }
                    }
                });
            }
        });
        
        // 4. Processa Streak
        await processarStreak(userId);

        return { success: true, xpGained, isScheduledReview };
    } catch (error) {
        console.error("Erro ao registrar revisão:", error);
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

// --- 15. OBTER PERFIL DO USUÁRIO (HUD) ---
export async function obterPerfilUsuario() {
    const { userId } = await auth();
    if (!userId) return null;

    try {
        const profile = await prisma.userProfile.findUnique({
            where: { userId },
            // include: { unlockedRewards: true } // Futuro
        });
        
        // Se não tiver perfil ainda, retorna um padrão zerado para não quebrar a UI
        if (!profile) return { xp: 0, level: 1, currentStreak: 0, weeklyXp: 0 };
        
        return profile;
    } catch (error) {
        console.error("Erro ao buscar perfil:", error);
        return null;
    }
}

// --- 16. CONCLUIR TÓPICO DA TRILHA (GAMIFICATION) ---
export async function concluirTopico(topicId: string) {
    const { userId } = await auth();
    if (!userId) return { success: false };

    try {
        // 1. Verifica se o tópico existe e pertence a um plano do usuário
        const topic = await prisma.topic.findFirst({
            where: { 
                id: topicId,
                plan: { userId } // Garante segurança (só dono altera)
            }
        });

        if (!topic) return { success: false, error: "Tópico não encontrado" };
        if (topic.isCompleted) return { success: false, error: "Já concluído!" }; // Evita farmar XP clicando 2x

        // 2. Transação: Marca concluído + Dá XP
        await prisma.$transaction(async (tx) => {
            // Marca Check
            await tx.topic.update({
                where: { id: topicId },
                data: { isCompleted: true }
            });

            // Dá o XP
            await tx.userProfile.upsert({
                where: { userId },
                create: { userId, xp: XP_VALUES.COMPLETE_TOPIC, weeklyXp: XP_VALUES.COMPLETE_TOPIC },
                update: { 
                    xp: { increment: XP_VALUES.COMPLETE_TOPIC },
                    weeklyXp: { increment: XP_VALUES.COMPLETE_TOPIC }
                }
            });
        });

        return { success: true };
    } catch (error) {
        console.error("Erro ao concluir tópico:", error);
        return { success: false };
    }
}