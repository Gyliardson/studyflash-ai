import { createHash } from "node:crypto";

import { Prisma } from "@prisma/client";
import prisma from "./db.ts";

const MAX_SERIALIZABLE_ATTEMPTS = 5;
const REQUEST_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

export function mutationFingerprint(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function normalizedDeckNameKey(name) {
  return name.trim().normalize("NFKC").toLocaleLowerCase("pt-BR");
}

function validRequestKey(requestKey) {
  return typeof requestKey === "string" && REQUEST_KEY_PATTERN.test(requestKey);
}

function isRetryableTransactionConflict(error) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code === "P2034") return true;
  return error.code === "P2002" && error.meta?.modelName === "UserProfile";
}

function isReceiptConflict(error) {
  return error instanceof Prisma.PrismaClientKnownRequestError
    && error.code === "P2002"
    && error.meta?.modelName === "MutationReceipt";
}

export function isDeckNameConflict(error) {
  return error instanceof Prisma.PrismaClientKnownRequestError
    && error.code === "P2002"
    && error.meta?.modelName === "Deck";
}

async function resolveReceipt(db, userId, kind, requestKey, fingerprint, replay) {
  const receipt = await db.mutationReceipt.findUnique({
    where: { userId_kind_requestKey: { userId, kind, requestKey } },
  });
  if (!receipt) return null;
  if (receipt.fingerprint !== fingerprint) {
    return { success: false, error: "Esta tentativa de criação não corresponde mais ao conteúdo original." };
  }
  return replay(receipt, db);
}

export async function readMutationReplay({ userId, kind, requestKey, fingerprint, replay }) {
  if (!validRequestKey(requestKey)) return { success: false, error: "Identificador de criação inválido." };
  return resolveReceipt(prisma, userId, kind, requestKey, fingerprint, replay);
}

export async function runMutationWithReceipt({ userId, kind, requestKey, fingerprint, replay }, operation) {
  if (!validRequestKey(requestKey)) return { success: false, error: "Identificador de criação inválido." };

  for (let attempt = 1; attempt <= MAX_SERIALIZABLE_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const existing = await resolveReceipt(tx, userId, kind, requestKey, fingerprint, replay);
        if (existing) return existing;

        const effect = await operation(tx);
        if (!effect?.success) return effect;

        await tx.mutationReceipt.create({
          data: {
            userId,
            kind,
            requestKey,
            fingerprint,
            resultId: effect.receiptResultId,
            xpAwarded: effect.receiptXpAwarded ?? 0,
          },
        });

        const response = { ...effect };
        delete response.receiptResultId;
        delete response.receiptXpAwarded;
        return response;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (isRetryableTransactionConflict(error) && attempt < MAX_SERIALIZABLE_ATTEMPTS) continue;
      if (isReceiptConflict(error)) {
        const replayed = await resolveReceipt(prisma, userId, kind, requestKey, fingerprint, replay);
        if (replayed) return replayed;
      }
      throw error;
    }
  }

  return { success: false, error: "Não foi possível concluir a criação com segurança." };
}

export async function createDeckForUser(userId, name, requestKey) {
  const nameKey = normalizedDeckNameKey(name);
  const fingerprint = mutationFingerprint({ nameKey });

  try {
    return await runMutationWithReceipt({
      userId,
      kind: "CREATE_DECK",
      requestKey,
      fingerprint,
      replay: async (receipt, db) => {
        if (!receipt.resultId) return { success: false, error: "Resultado da criação indisponível." };
        const deck = await db.deck.findUnique({ where: { id: receipt.resultId, userId } });
        if (!deck) return { success: false, error: "O baralho criado anteriormente não existe mais." };
        return { success: true, deck };
      },
    }, async (tx) => {
      const existing = await tx.deck.findFirst({
        where: { userId, nome: { equals: name, mode: "insensitive" } },
        select: { id: true },
      });
      if (existing) return { success: false, error: "Já existe um grupo com este nome!" };

      const deck = await tx.deck.create({ data: { userId, nome: name, nameKey } });
      return { success: true, deck, receiptResultId: deck.id };
    });
  } catch (error) {
    if (isDeckNameConflict(error)) return { success: false, error: "Já existe um grupo com este nome!" };
    throw error;
  }
}

export async function persistStudyPlanForUser(userId, planData, requestKey, intentFingerprint) {
  return runMutationWithReceipt({
    userId,
    kind: "CREATE_STUDY_PLAN",
    requestKey,
    fingerprint: intentFingerprint,
    replay: async (receipt, db) => {
      if (!receipt.resultId) return { success: false, error: "Resultado da criação indisponível." };
      const plan = await db.studyPlan.findUnique({ where: { id: receipt.resultId, userId }, select: { id: true } });
      if (!plan) return { success: false, error: "O plano criado anteriormente não existe mais." };
      return { success: true, planoId: plan.id };
    },
  }, async (tx) => {
    const plan = await tx.studyPlan.create({
      data: {
        userId,
        title: planData.title,
        description: planData.description,
        difficulty: planData.difficulty,
        topics: { create: planData.topics.map((topic, index) => ({ title: topic.title, order: index + 1 })) },
      },
      select: { id: true },
    });
    return { success: true, planoId: plan.id, receiptResultId: plan.id };
  });
}

export async function persistTopicCardsForUser(userId, topicId, cards, requestKey) {
  const fingerprint = mutationFingerprint({ topicId });
  return runMutationWithReceipt({
    userId,
    kind: "GENERATE_TOPIC_CARDS",
    requestKey,
    fingerprint,
    replay: async (receipt, db) => {
      const ownedTopic = await db.topic.findFirst({ where: { id: receipt.resultId ?? topicId, plan: { userId } }, select: { id: true } });
      if (!ownedTopic) return { success: false, error: "Tópico não encontrado" };
      return { success: true };
    },
  }, async (tx) => {
    const ownedTopic = await tx.topic.findFirst({ where: { id: topicId, plan: { userId } }, select: { id: true } });
    if (!ownedTopic) return { success: false, error: "Tópico não encontrado" };
    await tx.flashcard.createMany({
      data: cards.map((card) => ({ userId, frente: card.frente, verso: card.verso, topicId })),
    });
    return { success: true, receiptResultId: topicId };
  });
}
