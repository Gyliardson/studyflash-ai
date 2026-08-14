"use server";

import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/db";
import { getAiApiHeaders, getAiApiUrl } from "@/lib/ai-api";
import {
    completeTopicForUser,
    createExamAttemptForUser,
    finalizeExamForUser,
    recordReviewForUser,
    saveFlashcardsForUser,
} from "@/lib/gamification-transactions";

type FlashcardInput = { frente: string; verso: string };
type MutationResult<T extends object = object> = ({ success: true; error?: undefined } & T) | { success: false; error: string };
type ExamStartCard = { id: string; frente: string; options: string[] };
type ExamStartResult = MutationResult<{ attemptId: string; cards: ExamStartCard[] }>;

const DECK_NAME_MAX_LENGTH = 80;
const FLASHCARD_SIDE_MAX_LENGTH = 2000;

function normalizeDeckName(value: string): MutationResult<{ name: string }> {
    const name = typeof value === "string" ? value.trim() : "";
    if (!name) return { success: false, error: "Informe um nome para o baralho." };
    if (name.length > DECK_NAME_MAX_LENGTH) return { success: false, error: `O nome do baralho deve ter no máximo ${DECK_NAME_MAX_LENGTH} caracteres.` };
    return { success: true, name };
}

function normalizeFlashcards(cards: FlashcardInput[]): MutationResult<{ cards: FlashcardInput[] }> {
    if (!Array.isArray(cards) || cards.length === 0) return { success: false, error: "Nenhum flashcard para salvar." };
    const normalized: FlashcardInput[] = [];
    for (const card of cards) {
        const frente = typeof card?.frente === "string" ? card.frente.trim() : "";
        const verso = typeof card?.verso === "string" ? card.verso.trim() : "";
        if (!frente || !verso) return { success: false, error: "Frente e verso do flashcard são obrigatórios." };
        if (frente.length > FLASHCARD_SIDE_MAX_LENGTH || verso.length > FLASHCARD_SIDE_MAX_LENGTH) {
            return { success: false, error: `Cada lado do flashcard deve ter no máximo ${FLASHCARD_SIDE_MAX_LENGTH} caracteres.` };
        }
        normalized.push({ frente, verso });
    }
    return { success: true, cards: normalized };
}

export async function criarBaralho(nome: string) {
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Logue para criar grupos." };
    const normalized = normalizeDeckName(nome);
    if (!normalized.success) return normalized;
    try {
        const existente = await prisma.deck.findFirst({ where: { userId, nome: { equals: normalized.name, mode: "insensitive" } } });
        if (existente) return { success: false, error: "Já existe um grupo com este nome!" };
        const deck = await prisma.deck.create({ data: { userId, nome: normalized.name } });
        return { success: true, deck };
    } catch (error) {
        console.error("Erro ao criar deck:", error);
        return { success: false, error: "Erro ao criar grupo." };
    }
}

export async function listarMeusBaralhos() {
    const { userId } = await auth();
    if (!userId) return [];
    try {
        return await prisma.deck.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, include: { _count: { select: { cards: true } } } });
    } catch {
        return [];
    }
}

export async function salvarFlashcards(cards: FlashcardInput[], deckId?: string, newDeckName?: string) {
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Login necessário." };
    const normalized = normalizeFlashcards(cards);
    if (!normalized.success) return normalized;
    let normalizedDeckName: string | undefined;
    if (newDeckName !== undefined) {
        if (deckId) return { success: false, error: "Destino de flashcards inválido." };
        const deckNameResult = normalizeDeckName(newDeckName);
        if (!deckNameResult.success) return deckNameResult;
        normalizedDeckName = deckNameResult.name;
    }
    try {
        return await saveFlashcardsForUser(userId, normalized.cards, deckId, undefined, normalizedDeckName);
    } catch (error) {
        console.error("Erro ao salvar:", error);
        return { success: false, error: "Falha ao salvar no banco." };
    }
}

export async function listarCardsDoBaralho(deckId: string) {
    const { userId } = await auth();
    if (!userId) return [];
    try {
        return await prisma.flashcard.findMany({ where: { userId, deckId }, orderBy: { createdAt: "desc" } });
    } catch {
        return [];
    }
}

export async function excluirBaralho(id: string) {
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Não autorizado" };
    try {
        await prisma.deck.delete({ where: { id, userId } });
        return { success: true };
    } catch (error) {
        console.error("Erro ao excluir:", error);
        return { success: false, error: "Erro ao excluir baralho." };
    }
}

export async function excluirFlashcard(id: string) {
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Não autorizado" };
    try {
        await prisma.flashcard.delete({ where: { id, userId } });
        return { success: true };
    } catch {
        return { success: false, error: "Erro ao excluir flashcard." };
    }
}

export async function buscarCartoesParaRevisar(modoExtra = false, deckIds: string[] = [], planId?: string, topicId?: string) {
    const { userId } = await auth();
    if (!userId) return [];
    try {
        const whereCondition: Record<string, unknown> = { userId };
        if (topicId) whereCondition.topicId = topicId;
        else if (planId) whereCondition.topic = { planId };
        else if (deckIds.length > 0) whereCondition.deckId = { in: deckIds };
        if (!modoExtra) whereCondition.nextReview = { lte: new Date() };
        return await prisma.flashcard.findMany({ where: whereCondition, orderBy: { nextReview: "asc" }, take: 20 });
    } catch (error) {
        console.error("Erro ao buscar revisões:", error);
        return [];
    }
}

export async function registrarRevisao(cardId: string, avaliacao: "errei" | "dificil" | "facil") {
    const { userId } = await auth();
    if (!userId) return { success: false };
    try {
        return await recordReviewForUser(userId, cardId, avaliacao);
    } catch (error) {
        console.error("Erro ao registrar revisão:", error);
        return { success: false };
    }
}

export async function contarTotalFlashcards(deckIds: string[] = [], planId?: string, topicId?: string) {
    const { userId } = await auth();
    if (!userId) return 0;
    try {
        const whereCondition: Record<string, unknown> = { userId };
        if (topicId) whereCondition.topicId = topicId;
        else if (planId) whereCondition.topic = { planId };
        else if (deckIds.length > 0) whereCondition.deckId = { in: deckIds };
        return await prisma.flashcard.count({ where: whereCondition });
    } catch {
        return 0;
    }
}

export async function gerarSalvarPlano(tema: string, dificuldade: string) {
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Login necessário para criar planos." };
    try {
        const response = await fetch(`${getAiApiUrl()}/api/gerar-plano`, {
            method: "POST",
            headers: getAiApiHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify({ tema, dificuldade }),
            cache: "no-store",
        });
        if (!response.ok) throw new Error("Erro ao comunicar com o Tutor IA.");
        const planoIA = await response.json();
        const novoPlano = await prisma.studyPlan.create({
            data: {
                userId,
                title: planoIA.titulo,
                description: planoIA.descricao,
                difficulty: planoIA.dificuldade,
                topics: { create: planoIA.topicos.map((topic: { titulo: string }, index: number) => ({ title: topic.titulo, order: index + 1 })) },
            },
            include: { topics: true },
        });
        return { success: true, planoId: novoPlano.id };
    } catch (error) {
        console.error("Erro ao gerar plano:", error);
        return { success: false, error: "Falha ao criar o plano de estudos." };
    }
}

export async function listarMeusPlanos() {
    const { userId } = await auth();
    if (!userId) return [];
    try {
        return await prisma.studyPlan.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, include: { topics: { orderBy: { order: "asc" } } } });
    } catch {
        return [];
    }
}

export async function buscarPlanoPorId(id: string) {
    const { userId } = await auth();
    if (!userId) return null;
    return prisma.studyPlan.findUnique({ where: { id, userId }, include: { topics: { orderBy: { order: "asc" }, include: { _count: { select: { cards: true } } } } } });
}

export async function gerarCardsParaTopico(planTitle: string, topicId: string, topicTitle: string) {
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Não autorizado" };
    try {
        const ownedTopic = await prisma.topic.findFirst({ where: { id: topicId, plan: { userId } }, select: { id: true } });
        if (!ownedTopic) return { success: false, error: "Tópico não encontrado" };
        const response = await fetch(`${getAiApiUrl()}/api/gerar-cards-topico`, {
            method: "POST",
            headers: getAiApiHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify({ tema_plano: planTitle, titulo_topico: topicTitle }),
            cache: "no-store",
        });
        if (!response.ok) throw new Error("Falha na IA");
        const data = await response.json();
        await prisma.flashcard.createMany({ data: data.cartoes.map((card: FlashcardInput) => ({ userId, frente: card.frente, verso: card.verso, topicId })) });
        return { success: true };
    } catch (error) {
        console.error("Erro ao gerar cards do tópico:", error);
        return { success: false, error: "Erro ao gerar conteúdo." };
    }
}

export async function excluirPlano(id: string) {
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Não autorizado" };
    try {
        await prisma.studyPlan.delete({ where: { id, userId } });
        return { success: true };
    } catch (error) {
        console.error("Erro ao excluir plano:", error);
        return { success: false, error: "Erro ao excluir plano." };
    }
}

export async function obterPerfilUsuario() {
    const { userId } = await auth();
    if (!userId) return null;
    try {
        const profile = await prisma.userProfile.findUnique({ where: { userId } });
        if (!profile) return { xp: 0, level: 1, currentStreak: 0, weeklyXp: 0 };
        return profile;
    } catch (error) {
        console.error("Erro ao buscar perfil:", error);
        return null;
    }
}

export async function concluirTopico(topicId: string) {
    const { userId } = await auth();
    if (!userId) return { success: false };
    try {
        return await completeTopicForUser(userId, topicId);
    } catch (error) {
        console.error("Erro ao concluir tópico:", error);
        return { success: false };
    }
}

export async function iniciarSimulado(
    mode: "DECK" | "TOPIC" | "PLAN" | "GLOBAL",
    sourceId: string | undefined,
    quantity: number,
    difficulty: "EASY" | "MEDIUM" | "HARD" | "IMPOSSIBLE",
): Promise<ExamStartResult> {
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Login necessário." };
    if (mode !== "GLOBAL" && !sourceId) return { success: false, error: "Fonte de prova inválida." };
    try {
        const whereCondition: Record<string, unknown> = { userId };
        if (mode === "DECK" && sourceId) whereCondition.deckId = sourceId;
        if (mode === "TOPIC" && sourceId) whereCondition.topicId = sourceId;
        if (mode === "PLAN" && sourceId) whereCondition.topic = { planId: sourceId };
        const allCards = await prisma.flashcard.findMany({ where: whereCondition, select: { id: true, frente: true, verso: true } });
        if (allCards.length < 4) return { success: false, error: "Você precisa de pelo menos 4 flashcards para criar alternativas." };
        const maxQuestions = Math.min(Math.max(1, quantity), 15);
        const selectedCards = [...allCards].sort(() => 0.5 - Math.random()).slice(0, maxQuestions);
        let questoesIA: { card_id: string; alternativas?: string[] }[] = [];
        try {
            const aiResponse = await fetch(`${getAiApiUrl()}/api/gerar-prova`, {
                method: "POST",
                headers: getAiApiHeaders({ "Content-Type": "application/json" }),
                body: JSON.stringify({ cartoes: selectedCards.map((card) => ({ id: card.id, frente: card.frente, verso: card.verso })) }),
                cache: "no-store",
                signal: AbortSignal.timeout(8000),
            });
            if (aiResponse.ok) questoesIA = await aiResponse.json();
        } catch {
            console.log("IA indisponível ou lenta, usando gerador local.");
        }
        const finalExam = selectedCards.map((card) => {
            const aiData = questoesIA.find((question) => question.card_id === card.id);
            let options = aiData?.alternativas && aiData.alternativas.length >= 2 && aiData.alternativas.includes(card.verso) ? [...aiData.alternativas] : null;
            if (!options) {
                const wrongAnswers = allCards.filter((candidate) => candidate.id !== card.id).sort(() => 0.5 - Math.random()).slice(0, 3).map((candidate) => candidate.verso);
                options = [card.verso, ...wrongAnswers];
            }
            return { ...card, options: options.sort(() => 0.5 - Math.random()) };
        });
        const attempt = await createExamAttemptForUser(userId, {
            sourceType: mode,
            sourceId,
            difficulty,
            questions: finalExam.map((card) => ({ flashcardId: card.id, prompt: card.frente, expectedAnswer: card.verso, options: card.options })),
        });
        if (!attempt.success || !attempt.attemptId) {
            return { success: false, error: attempt.error || "Falha ao registrar a tentativa da prova." };
        }
        return {
            success: true,
            attemptId: attempt.attemptId,
            cards: finalExam.map((card) => ({ id: card.id, frente: card.frente, options: card.options })),
        };
    } catch (error) {
        console.error("Erro crítico ao iniciar simulado:", error);
        return { success: false, error: "Falha ao gerar a prova." };
    }
}

export async function finalizarSimulado(resultado: {
    attemptId: string;
    timeSpentSeconds: number;
    answers: { flashcardId: string; selectedOption: string | null; timeTaken: number }[];
}) {
    const { userId } = await auth();
    if (!userId) return { success: false };
    try {
        return await finalizeExamForUser(userId, resultado);
    } catch (error) {
        console.error("Erro ao salvar simulado:", error);
        return { success: false, error: "Falha ao finalizar a prova." };
    }
}