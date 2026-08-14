export type ReviewEvaluation = "errei" | "dificil" | "facil";

export type StudySessionScope = {
  deckIds?: string[];
  planId?: string;
  topicId?: string;
  modeExtra?: boolean;
};

export type StudySessionCard = {
  id: string;
  frente: string;
  verso: string;
};

export function startOrResumeStudySessionForUser(
  userId: string,
  input?: StudySessionScope,
  now?: Date,
): Promise<{
  success: boolean;
  error?: string;
  sessionId?: string;
  modeExtra?: boolean;
  resumed?: boolean;
  cards: StudySessionCard[];
}>;

export function recordStudySessionReviewForUser(
  userId: string,
  sessionId: string,
  cardId: string,
  evaluation: ReviewEvaluation,
  now?: Date,
): Promise<{
  success: boolean;
  error?: string;
  replayed?: boolean;
  xpGained?: number;
  isScheduledReview?: boolean;
}>;
