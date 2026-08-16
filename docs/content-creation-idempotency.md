# StudyFlash content-creation idempotency

StudyFlash treats an automatic retry as the same user intent, not as permission to create more content.

## Request identity

Create/save UI flows generate a random request key in the browser when a user intent starts. That key is retained while the same form/content/destination is being retried after an ambiguous failure. Changing the intent resets the key. After confirmed success the key is discarded, so a later deliberate create action receives a new identity.

The server also derives a SHA-256 fingerprint from the normalized semantic input. Reusing a request key with different input fails closed instead of replaying or overwriting another result.

## Durable receipt invariant

`MutationReceipt` is a receipt for a **completed** mutation, not a job queue. There is deliberately no `PENDING` state.

For database-backed create operations, the content/XP effect and receipt are written inside the same serializable PostgreSQL transaction. Therefore:

- if the transaction rolls back, neither content nor receipt exists;
- if it commits and the network response is lost, the receipt exists with the effect;
- retry with the same key/fingerprint returns the canonical committed result;
- concurrent retries race on the unique `(userId, kind, requestKey)` invariant and converge after the losing transaction rolls back/retries;
- a replay does not grant XP again.

AI-backed plan/topic actions check for a completed receipt **before** calling the provider. Concurrent first calls can still perform duplicate remote inference, but only one database effect may commit. This intentionally prioritizes durable data correctness over coordinating an external LLM call with PostgreSQL.

## Deck names and existing data

New/updated deck writes get a database-normalized `nameKey` through a PostgreSQL trigger and are constrained by unique `(userId, nameKey)`. This closes the previous `findFirst -> create` race even for older create call paths.

The migration does not backfill or delete existing decks: pre-migration rows keep `nameKey = NULL`. Application-level case-insensitive lookup continues to stop a new create from colliding with an existing legacy name. This avoids silently choosing which historical user deck to rename/delete if old duplicate names already exist.

## Operation semantics

- **Save cards:** same request key + same normalized cards/destination returns the persisted deck/XP result; no second card batch or XP history entry is created. A new key means an explicit new save/append intent.
- **Create plan:** same key + same topic/difficulty returns the first committed plan. A retry does not replace it if a second AI response would differ. A new key is a new plan-generation intent.
- **Generate topic cards:** same key for the same topic returns completion without appending again. A new key is an explicit new generation/append intent at the persistence boundary.
- **Create deck:** the receipt provides retry recovery for callers using the idempotent boundary, while database name uniqueness independently prevents concurrent same-name duplicates.

## Security and ownership

Receipts are always scoped by authenticated `userId + kind + requestKey`. Deck/card/topic/plan persistence performs ownership checks in the transaction. Topic-generation prompts derive plan/topic titles from the owned database row rather than trusting client-supplied titles.

Request keys are bounded opaque identifiers, not authorization tokens. Knowledge of another user's key cannot retrieve or mutate that user's data.

## Verification

`frontend/tests/content-creation-idempotency.test.mjs` exercises sequential replay, concurrent replay, key/input tampering, atomic deck-name uniqueness, first-plan-result preservation, intentional topic append via a new key, and foreign-topic isolation against disposable PostgreSQL.

`frontend/e2e/tests/idempotent-create.spec.ts` exercises the ambiguous browser failure directly: the save Server Action is allowed to commit, its response is dropped, the UI retries with the retained key, and the test verifies one card batch, one mutation receipt, and XP equal to the receipt's single committed award.
