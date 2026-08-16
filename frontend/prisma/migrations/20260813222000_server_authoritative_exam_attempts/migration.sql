-- Bind exam configuration and expected answers to a server-side attempt so
-- score/XP cannot be decided by untrusted browser fields.
CREATE TABLE "ExamAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceDeckId" TEXT,
    "sourceTopicId" TEXT,
    "sourcePlanId" TEXT,
    "sourceType" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizedAt" TIMESTAMP(3),
    CONSTRAINT "ExamAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExamAttemptQuestion" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "flashcardId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "expectedAnswer" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "order" INTEGER NOT NULL,
    CONSTRAINT "ExamAttemptQuestion_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ExamSession" ADD COLUMN "attemptId" TEXT;

CREATE UNIQUE INDEX "ExamSession_attemptId_key" ON "ExamSession"("attemptId");
CREATE INDEX "ExamAttempt_userId_status_idx" ON "ExamAttempt"("userId", "status");
CREATE INDEX "ExamAttempt_expiresAt_idx" ON "ExamAttempt"("expiresAt");
CREATE UNIQUE INDEX "ExamAttemptQuestion_attemptId_flashcardId_key" ON "ExamAttemptQuestion"("attemptId", "flashcardId");
CREATE UNIQUE INDEX "ExamAttemptQuestion_attemptId_order_key" ON "ExamAttemptQuestion"("attemptId", "order");
CREATE INDEX "ExamAttemptQuestion_attemptId_idx" ON "ExamAttemptQuestion"("attemptId");

ALTER TABLE "ExamAttemptQuestion"
ADD CONSTRAINT "ExamAttemptQuestion_attemptId_fkey"
FOREIGN KEY ("attemptId") REFERENCES "ExamAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExamSession"
ADD CONSTRAINT "ExamSession_attemptId_fkey"
FOREIGN KEY ("attemptId") REFERENCES "ExamAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
