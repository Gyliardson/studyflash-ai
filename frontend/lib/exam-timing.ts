export type ExamQuestionClaim = {
  accepted: boolean;
  claimedQuestionIndex: number | null;
};

export function claimExamQuestionSubmission(
  claimedQuestionIndex: number | null,
  currentQuestionIndex: number,
): ExamQuestionClaim {
  if (!Number.isInteger(currentQuestionIndex) || currentQuestionIndex < 0) {
    throw new RangeError("Exam question index must be a non-negative integer.");
  }

  if (claimedQuestionIndex === currentQuestionIndex) {
    return { accepted: false, claimedQuestionIndex };
  }

  return { accepted: true, claimedQuestionIndex: currentQuestionIndex };
}

export function examQuestionDeadlineMs(startedAtMs: number, limitSeconds: number): number {
  if (!Number.isFinite(startedAtMs) || !Number.isFinite(limitSeconds) || limitSeconds < 0) {
    throw new RangeError("Exam timer inputs must be finite and the limit must be non-negative.");
  }
  return startedAtMs + limitSeconds * 1000;
}

export function remainingExamQuestionSeconds(deadlineMs: number, nowMs: number): number {
  if (!Number.isFinite(deadlineMs) || !Number.isFinite(nowMs)) {
    throw new RangeError("Exam timer instants must be finite.");
  }
  return Math.max(0, Math.ceil((deadlineMs - nowMs) / 1000));
}
