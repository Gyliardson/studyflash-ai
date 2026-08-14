export type ReviewEvaluation = "errei" | "dificil" | "facil";
export type ExamDifficulty = "EASY" | "MEDIUM" | "HARD" | "IMPOSSIBLE";
export type ExamSourceType = "DECK" | "TOPIC" | "PLAN" | "GLOBAL";

export type ExamAttemptQuestionInput = {
  flashcardId: string;
  prompt: string;
  expectedAnswer: string;
  options: string[];
};

export type ExamAttemptInput = {
  difficulty: ExamDifficulty;
  sourceType: ExamSourceType;
  sourceId?: string;
  questions: ExamAttemptQuestionInput[];
};

export type ExamResultInput = {
  attemptId: string;
  timeSpentSeconds: number;
  answers: {
    flashcardId: string;
    selectedOption: string | null;
    timeTaken: number;
  }[];
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

export function createExamAttemptForUser(
  userId: string,
  input: ExamAttemptInput,
  now?: Date,
): Promise<{
  success: boolean;
  error?: string;
  attemptId?: string;
  expiresAt?: Date;
}>;

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
  correctAnswers?: number;
  totalQuestions?: number;
  difficulty?: ExamDifficulty;
  sourceType?: ExamSourceType;
  sourceId?: string;
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
