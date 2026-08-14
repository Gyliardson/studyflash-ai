# StudyFlash exam integrity

StudyFlash treats exam score and XP as server-authoritative product state.

## Attempt lifecycle

Starting an exam creates a database-backed `ExamAttempt` for the authenticated Clerk user. The attempt snapshots the selected source, difficulty, question IDs, expected answers and answer options before the browser receives the exam. Attempts expire two hours after creation.

The browser receives the attempt ID, prompts and shuffled options. It does **not** receive the expected answer field used by final scoring and it does not submit `isCorrect`, final difficulty or final source.

Finalization accepts only the attempt ID, selected option per question (or `null` for an unanswered/timed-out question) and timing telemetry. Timing is informational and does not increase XP.

## Server evaluation

Inside a serializable PostgreSQL transaction, finalization:

1. loads the attempt by `id + authenticated user`;
2. rejects unknown, foreign, expired or already-finalized attempts;
3. validates exact answer cardinality, unique question IDs and that every selected value belongs to the server-snapshotted option set;
4. atomically claims the attempt from `ACTIVE` to `COMPLETED`;
5. recomputes correctness against the snapshotted expected answers;
6. derives score, difficulty multiplier and daily XP eligibility only from server state;
7. writes one linked `ExamSession`, per-question evaluated results and the XP ledger in the same transaction.

`ExamSession.attemptId` is unique, providing an additional durable replay invariant.

## Abuse and failure semantics

- Replaying the same attempt cannot award XP twice.
- Concurrent finalization races are serialized/retried and only one caller can claim the attempt.
- Client-supplied legacy fields such as `isCorrect`, `difficulty`, `sourceType`, `correctAnswers` or `score` are not authoritative and are not part of the supported finalization contract.
- Partial, duplicate, foreign-question and forged-option answer sets are rejected before the attempt is consumed.
- Expired attempts are marked `EXPIRED` and cannot create sessions or XP history.
- Cross-user attempts and sources are rejected.
- Remote LLM availability is not required to validate score/XP integrity; critical tests use deterministic persisted fixtures and disposable PostgreSQL.

## Verification

`frontend/tests/gamification-concurrency.test.mjs` covers valid scoring and adversarial paths including forged correctness/difficulty/source data, replay, concurrency, expiry, malformed submissions, cross-user isolation and the daily XP cap. CI applies migrations to empty PostgreSQL 16, verifies migration history/schema parity, and then runs the ownership and gamification suites.
