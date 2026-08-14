-- Persist study queues so reload/retry semantics are explicit and review commits
-- can be coupled atomically to one durable session item.
CREATE TABLE "StudySession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "modeExtra" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "activeKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StudySession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StudySessionCard" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "flashcardId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "evaluation" TEXT,
    "xpGained" INTEGER,
    "isScheduledReview" BOOLEAN,
    "committedAt" TIMESTAMP(3),
    CONSTRAINT "StudySessionCard_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StudySession_activeKey_key" ON "StudySession"("activeKey");
CREATE INDEX "StudySession_userId_status_scopeKey_idx" ON "StudySession"("userId", "status", "scopeKey");
CREATE UNIQUE INDEX "StudySessionCard_sessionId_flashcardId_key" ON "StudySessionCard"("sessionId", "flashcardId");
CREATE UNIQUE INDEX "StudySessionCard_sessionId_order_key" ON "StudySessionCard"("sessionId", "order");
CREATE INDEX "StudySessionCard_sessionId_status_order_idx" ON "StudySessionCard"("sessionId", "status", "order");
CREATE INDEX "StudySessionCard_flashcardId_idx" ON "StudySessionCard"("flashcardId");

ALTER TABLE "StudySessionCard"
ADD CONSTRAINT "StudySessionCard_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "StudySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudySessionCard"
ADD CONSTRAINT "StudySessionCard_flashcardId_fkey"
FOREIGN KEY ("flashcardId") REFERENCES "Flashcard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
