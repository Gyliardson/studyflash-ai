export type ReviewEvaluation = "errei" | "dificil" | "facil";

export type StudySessionScope = {
  topicId?: string;
  planId?: string;
  deckIds?: string[];
  modeExtra?: boolean;
};

export type StudySessionCardView = {
  id: string;
  frente: string;
  verso: string;
};

export type StudySessionStartResult =
  | {
      success: true;
      sessionId?: string;
      modeExtra: boolean;
      resumed: boolean;
      cards: StudySessionCardView[];
    }
  | {
      success: false;
      error: string;
      cards: StudySessionCardView[];
    };

export type StudySessionReviewResult =
  | {
      success: true;
      replayed: boolean;
      xpGained: number;
      isScheduledReview: boolean;
    }
  | {
      success: false;
      error: string;
    };

export function startOrResumeStudySessionForUser(
  userId: string,
  input?: StudySessionScope,
  now?: Date,
): Promise<StudySessionStartResult>;

export function recordStudySessionReviewForUser(
  userId: string,
  sessionId: string,
  cardId: string,
  evaluation: ReviewEvaluation,
  now?: Date,
): Promise<StudySessionReviewResult>;
