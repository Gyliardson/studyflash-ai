export type ReviewEvaluation = "errei" | "dificil" | "facil";

export type ExamResultInput = {
  totalQuestions: number;
  correctAnswers: number;
  timeSpentSeconds: number;
  difficulty: "EASY" | "MEDIUM" | "HARD" | "IMPOSSIBLE";
  sourceType: string;
  sourceId?: string;
  answers: { flashcardId: string; isCorrect: boolean; timeTaken: number }[];
};

export function saveFlashcardsForUser(
  userId: string,
  cards: { frente: string; verso: string }[],
  deckId?: string,
  now?: Date,
): Promise<{ success: boolean; error?: string; xpGained?: number }>;

export function recordReviewForUser(
  userId: string,
  cardId: string,
  evaluation: ReviewEvaluation,
  now?: Date,
): Promise<{ success: boolean; xpGained?: number; isScheduledReview?: boolean }>;

export function completeTopicForUser(
  userId: string,
  topicId: string,
): Promise<{ success: boolean; error?: string }>;

export function finalizeExamForUser(
  userId: string,
  result: ExamResultInput,
  now?: Date,
): Promise<{
  success: boolean;
  error?: string;
  sessionId?: string;
  xpGained?: number;
  score?: number;
  limitReached?: boolean;
}>;

export function processStudyStreakForUser(
  userId: string,
  now?: Date,
): Promise<{ streakBonus: boolean }>;

export function grantCreationXpForUser(
  userId: string,
  requestedXp: number,
  now?: Date,
): Promise<number>;
