type SaveResult =
  | { success: true; xpGained: number; deckId: string }
  | { success: false; error: string };

export function saveFlashcardsIdempotentForUser(
  userId: string,
  cards: { frente: string; verso: string }[],
  deckId: string | undefined,
  newDeckName: string | undefined,
  requestKey: string,
  now?: Date,
): Promise<SaveResult>;
