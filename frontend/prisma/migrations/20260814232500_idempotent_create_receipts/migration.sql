-- Add a nullable normalized-name key only for new deck writes. Existing rows remain
-- NULL so this migration never rewrites or deletes user data. Application-level
-- legacy-name lookup still prevents creating a new deck that collides with an old row.
ALTER TABLE "Deck" ADD COLUMN "nameKey" TEXT;

CREATE UNIQUE INDEX "Deck_userId_nameKey_key" ON "Deck"("userId", "nameKey");

-- A MutationReceipt exists only when its content mutation committed. The receipt
-- is inserted in the same transaction as the effect, so there is no orphaned
-- PENDING state to recover after process/network failure.
CREATE TABLE "MutationReceipt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "resultId" TEXT,
    "xpAwarded" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MutationReceipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MutationReceipt_userId_kind_requestKey_key"
ON "MutationReceipt"("userId", "kind", "requestKey");

CREATE INDEX "MutationReceipt_userId_kind_createdAt_idx"
ON "MutationReceipt"("userId", "kind", "createdAt");
