import { DAILY_LIMITS, XP_VALUES } from "./gamification.ts";
import { studyDayRange } from "./study-calendar.mjs";
import {
  isDeckNameConflict,
  mutationFingerprint,
  normalizedDeckNameKey,
  runMutationWithReceipt,
} from "./mutation-receipts.mjs";

async function ensureProfile(tx, userId) {
  return tx.userProfile.upsert({
    where: { userId },
    create: { userId, xp: 0, weeklyXp: 0 },
    update: {},
  });
}

async function grantCreationXp(tx, userId, requestedXp, now) {
  await ensureProfile(tx, userId);
  const { start, end } = studyDayRange(now);
  const history = await tx.xPHistory.aggregate({
    _sum: { amount: true },
    where: { userId, source: "CREATE_CARD", createdAt: { gte: start, lt: end } },
  });
  const remaining = Math.max(0, DAILY_LIMITS.MAX_XP_FROM_CREATION - (history._sum.amount ?? 0));
  const awarded = Math.min(Math.max(0, requestedXp), remaining);
  if (awarded > 0) {
    await tx.userProfile.update({
      where: { userId },
      data: { xp: { increment: awarded }, weeklyXp: { increment: awarded } },
    });
    await tx.xPHistory.create({ data: { userId, amount: awarded, source: "CREATE_CARD", createdAt: now } });
  }
  return awarded;
}

export async function saveFlashcardsIdempotentForUser(userId, cards, deckId, newDeckName, requestKey, now = new Date()) {
  if (!Array.isArray(cards) || cards.length === 0) return { success: false, error: "Nenhum flashcard para salvar." };
  if (deckId && newDeckName) return { success: false, error: "Destino de flashcards inválido." };

  const deckName = newDeckName ?? undefined;
  const nameKey = deckName ? normalizedDeckNameKey(deckName) : undefined;
  const fingerprint = mutationFingerprint({
    destination: deckId ? { deckId } : { newDeckName: nameKey ?? null },
    cards: cards.map((card) => ({ frente: card.frente, verso: card.verso })),
  });

  try {
    return await runMutationWithReceipt({
      userId,
      kind: "SAVE_FLASHCARDS",
      requestKey,
      fingerprint,
      replay: async (receipt, db) => {
        if (!receipt.resultId) return { success: false, error: "Resultado da criação indisponível." };
        const deck = await db.deck.findUnique({ where: { id: receipt.resultId, userId }, select: { id: true } });
        if (!deck) return { success: false, error: "O baralho usado nesta criação não existe mais." };
        return { success: true, xpGained: receipt.xpAwarded, deckId: deck.id };
      },
    }, async (tx) => {
      let persistedDeckId = deckId;
      if (deckId) {
        const ownedDeck = await tx.deck.findUnique({ where: { id: deckId, userId }, select: { id: true } });
        if (!ownedDeck) return { success: false, error: "Grupo não encontrado." };
        await tx.flashcard.createMany({
          data: cards.map((card) => ({ userId, frente: card.frente, verso: card.verso, deckId })),
        });
      } else {
        const generatedName = deckName ?? `Gerado em ${now.toLocaleDateString("pt-BR")} às ${now.getHours()}:${now.getMinutes()}`;
        const generatedNameKey = normalizedDeckNameKey(generatedName);
        const existing = await tx.deck.findFirst({
          where: { userId, nome: { equals: generatedName, mode: "insensitive" } },
          select: { id: true },
        });
        if (existing) return { success: false, error: "Já existe um grupo com este nome!" };

        const createdDeck = await tx.deck.create({
          data: {
            userId,
            nome: generatedName,
            nameKey: generatedNameKey,
            cards: { create: cards.map((card) => ({ userId, frente: card.frente, verso: card.verso })) },
          },
          select: { id: true },
        });
        persistedDeckId = createdDeck.id;
      }

      const requestedXp = Math.min(cards.length * XP_VALUES.CREATE_CARD, DAILY_LIMITS.MAX_XP_FROM_CREATION);
      const xpGained = await grantCreationXp(tx, userId, requestedXp, now);
      return {
        success: true,
        xpGained,
        deckId: persistedDeckId,
        receiptResultId: persistedDeckId,
        receiptXpAwarded: xpGained,
      };
    });
  } catch (error) {
    if (isDeckNameConflict(error)) return { success: false, error: "Já existe um grupo com este nome!" };
    throw error;
  }
}
