"use server";

import { auth } from "@clerk/nextjs/server";

import prisma from "@/lib/db";
import { getAiAbortSignal, getAiApiHeaders, getAiApiUrl } from "@/lib/ai-api";
import { isAbortTimeout, safeAiUserMessage } from "@/lib/ai-failure-policy";
import { saveFlashcardsIdempotentForUser } from "@/lib/content-creation-transactions.mjs";
import {
  createDeckForUser,
  mutationFingerprint,
  persistStudyPlanForUser,
  persistTopicCardsForUser,
  readMutationReplay,
} from "@/lib/mutation-receipts.mjs";

type FlashcardInput = { frente: string; verso: string };
type MutationResult<T extends object = object> = ({ success: true; error?: undefined } & T) | { success: false; error: string };

const DECK_NAME_MAX_LENGTH = 80;
const FLASHCARD_SIDE_MAX_LENGTH = 2000;
const PLAN_TOPIC_MAX_LENGTH = 160;
const VALID_DIFFICULTIES = new Set(["Iniciante", "Intermediário", "Avançado"]);

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

function normalizePlanIntent(topic: string, difficulty: string): MutationResult<{ topic: string; difficulty: string }> {
  const normalizedTopic = typeof topic === "string" ? topic.trim() : "";
  if (!normalizedTopic) return { success: false, error: "Informe um tópico para o plano." };
  if (normalizedTopic.length > PLAN_TOPIC_MAX_LENGTH) return { success: false, error: `O tópico deve ter no máximo ${PLAN_TOPIC_MAX_LENGTH} caracteres.` };
  if (!VALID_DIFFICULTIES.has(difficulty)) return { success: false, error: "Nível de dificuldade inválido." };
  return { success: true, topic: normalizedTopic, difficulty };
}

function normalizeGeneratedPlan(value: unknown): MutationResult<{
  plan: { title: string; description: string | null; difficulty: string; topics: { title: string }[] };
}> {
  if (!value || typeof value !== "object") return { success: false, error: "A IA retornou um plano inválido." };
  const plan = value as { titulo?: unknown; descricao?: unknown; dificuldade?: unknown; topicos?: unknown };
  const title = typeof plan.titulo === "string" ? plan.titulo.trim() : "";
  const description = typeof plan.descricao === "string" ? plan.descricao.trim() : null;
  const difficulty = typeof plan.dificuldade === "string" ? plan.dificuldade.trim() : "";
  if (!title || !difficulty || !Array.isArray(plan.topicos) || plan.topicos.length === 0) {
    return { success: false, error: "A IA retornou um plano inválido." };
  }
  const topics = plan.topicos.map((topic) => ({
    title: typeof topic === "object" && topic !== null && typeof (topic as { titulo?: unknown }).titulo === "string"
      ? (topic as { titulo: string }).titulo.trim()
      : "",
  }));
  if (topics.some((topic) => !topic.title)) return { success: false, error: "A IA retornou um plano inválido." };
  return { success: true, plan: { title, description, difficulty, topics } };
}

export async function criarBaralhoIdempotente(nome: string, requestKey: string) {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Logue para criar grupos." };
  const normalized = normalizeDeckName(nome);
  if (!normalized.success) return normalized;
  try {
    return await createDeckForUser(userId, normalized.name, requestKey);
  } catch (error) {
    console.error("Erro ao criar deck:", error);
    return { success: false, error: "Erro ao criar grupo." };
  }
}

export async function salvarFlashcardsIdempotente(cards: FlashcardInput[], deckId: string | undefined, newDeckName: string | undefined, requestKey: string) {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Login necessário." };
  const normalizedCards = normalizeFlashcards(cards);
  if (!normalizedCards.success) return normalizedCards;

  let normalizedDeckName: string | undefined;
  if (newDeckName !== undefined) {
    if (deckId) return { success: false, error: "Destino de flashcards inválido." };
    const deckName = normalizeDeckName(newDeckName);
    if (!deckName.success) return deckName;
    normalizedDeckName = deckName.name;
  }

  try {
    return await saveFlashcardsIdempotentForUser(userId, normalizedCards.cards, deckId, normalizedDeckName, requestKey);
  } catch (error) {
    console.error("Erro ao salvar:", error);
    return { success: false, error: "Falha ao salvar no banco." };
  }
}

export async function gerarSalvarPlanoIdempotente(tema: string, dificuldade: string, requestKey: string) {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Login necessário para criar planos." };
  const intent = normalizePlanIntent(tema, dificuldade);
  if (!intent.success) return intent;
  const fingerprint = mutationFingerprint({ topic: intent.topic, difficulty: intent.difficulty });

  try {
    const replay = await readMutationReplay({
      userId,
      kind: "CREATE_STUDY_PLAN",
      requestKey,
      fingerprint,
      replay: async (receipt, db) => {
        if (!receipt.resultId) return { success: false, error: "Resultado da criação indisponível." };
        const plan = await db.studyPlan.findUnique({ where: { id: receipt.resultId, userId }, select: { id: true } });
        return plan ? { success: true, planoId: plan.id } : { success: false, error: "O plano criado anteriormente não existe mais." };
      },
    });
    if (replay) return replay;

    const response = await fetch(`${getAiApiUrl()}/api/gerar-plano`, {
      method: "POST",
      headers: getAiApiHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ tema: intent.topic, dificuldade: intent.difficulty }),
      cache: "no-store",
      signal: getAiAbortSignal(),
    });
    if (!response.ok) return { success: false, error: safeAiUserMessage(response.status) };
    const generated = normalizeGeneratedPlan(await response.json());
    if (!generated.success) return generated;
    return await persistStudyPlanForUser(userId, generated.plan, requestKey, fingerprint);
  } catch (error) {
    console.error("Erro ao gerar plano:", error instanceof Error ? error.name : "UnknownError");
    return { success: false, error: isAbortTimeout(error) ? safeAiUserMessage(504) : "Falha ao criar o plano de estudos." };
  }
}

export async function gerarCardsParaTopicoIdempotente(topicId: string, requestKey: string) {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Não autorizado" };
  if (typeof topicId !== "string" || !topicId) return { success: false, error: "Tópico não encontrado" };
  const fingerprint = mutationFingerprint({ topicId });

  try {
    const replay = await readMutationReplay({
      userId,
      kind: "GENERATE_TOPIC_CARDS",
      requestKey,
      fingerprint,
      replay: async (receipt, db) => {
        const topic = await db.topic.findFirst({ where: { id: receipt.resultId ?? topicId, plan: { userId } }, select: { id: true } });
        return topic ? { success: true } : { success: false, error: "Tópico não encontrado" };
      },
    });
    if (replay) return replay;

    const topic = await prisma.topic.findFirst({
      where: { id: topicId, plan: { userId } },
      select: { id: true, title: true, plan: { select: { title: true } } },
    });
    if (!topic) return { success: false, error: "Tópico não encontrado" };

    const response = await fetch(`${getAiApiUrl()}/api/gerar-cards-topico`, {
      method: "POST",
      headers: getAiApiHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ tema_plano: topic.plan.title, titulo_topico: topic.title }),
      cache: "no-store",
      signal: getAiAbortSignal(),
    });
    if (!response.ok) return { success: false, error: safeAiUserMessage(response.status) };
    const payload = await response.json() as { cartoes?: FlashcardInput[] };
    const cards = normalizeFlashcards(payload.cartoes ?? []);
    if (!cards.success) return { success: false, error: "A IA retornou flashcards inválidos." };
    return await persistTopicCardsForUser(userId, topicId, cards.cards, requestKey);
  } catch (error) {
    console.error("Erro ao gerar cards do tópico:", error instanceof Error ? error.name : "UnknownError");
    return { success: false, error: isAbortTimeout(error) ? safeAiUserMessage(504) : "Erro ao gerar conteúdo." };
  }
}
