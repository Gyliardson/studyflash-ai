# StudyFlash exam integrity

StudyFlash treats exam score and XP as server-authoritative product state.

## Attempt lifecycle

Starting an exam creates a database-backed `ExamAttempt` for the authenticated Clerk user. The attempt snapshots the selected source, difficulty, question IDs, expected answers and answer options before the browser receives the exam. Attempts expire two hours after creation.

The browser receives the attempt ID, prompts and shuffled options. It does **not** receive the expected answer field used by final scoring and it does not submit `isCorrect`, final difficulty or final source.

Finalization accepts only the attempt ID, selected option per question (or `null` for an unanswered/timed-out question) and timing telemetry. Timing is informational and does not increase XP.

## Browser question submission contract

Timed exam questions use an explicit deadline derived from the question start instant and configured difficulty limit. The displayed countdown is recomputed from that deadline rather than mutating a decrementing counter as the source of truth.

Each rendered question also has a synchronous client-side claim keyed by its question index. Click submission and timeout submission must acquire the same claim before they can append an answer, advance the exam or enter finalization. A second click, or a timeout racing after a click on the same rendered question, is ignored. Advancing to the next question creates a new deadline and the new index becomes independently claimable.

Timeout handling runs outside React state updater callbacks. This keeps state calculation pure and prevents timer callbacks from embedding navigation/finalization side effects inside `setState` transitions.

This client-side claim is a UX/correctness guard, not a security boundary: browser timing and selected answers remain untrusted input. Server-side validation, ownership, canonical scoring and exactly-once persistence remain authoritative even if a client is modified or bypasses the UI.

## Server evaluation

Inside a serializable PostgreSQL transaction, first finalization:

1. loads the attempt by `id + authenticated user`;
2. rejects unknown, foreign or expired attempts;
3. validates exact answer cardinality, unique question IDs and that every selected value belongs to the server-snapshotted option set;
4. atomically claims the attempt from `ACTIVE` to `COMPLETED`;
5. recomputes correctness against the snapshotted expected answers;
6. derives score, difficulty multiplier and daily XP eligibility only from server state;
7. writes one linked `ExamSession`, per-question evaluated results and the XP ledger in the same transaction.

`ExamSession.attemptId` is unique, providing an additional durable exactly-once invariant.

## Idempotent retry contract

A completed, owned attempt is not evaluated again. Finalization resolves its unique persisted `ExamSession` and returns that canonical result without creating another session, granting XP, changing the streak or accepting rewritten score/timing state.

This makes an ambiguous lost-response failure recoverable: if the first request committed and its response never reached the browser, retry converges to the already-persisted result. Concurrent callers likewise converge on the same session after the serializable transaction resolves the race.

The current schema intentionally does **not** persist the selected option itself in `ExamSession`; it persists the evaluated per-question correctness and timing. Therefore StudyFlash does not claim that a completed retry can prove byte-for-byte equality with the original answer payload. Instead, completed attempts are immutable: retry payload fields cannot rewrite the persisted result. The first accepted submission remains the authoritative evaluation.

## Abuse and failure semantics

- Replaying the same completed attempt returns the canonical persisted result and cannot award XP twice.
- Concurrent finalization races are serialized/retried and converge on one `ExamSession` and one XP/streak effect.
- Client-supplied legacy fields such as `isCorrect`, `difficulty`, `sourceType`, `correctAnswers` or `score` are not authoritative and are not part of the supported finalization contract.
- Partial, duplicate, foreign-question and forged-option answer sets are rejected before an active attempt is consumed.
- Retry-supplied answers or elapsed time cannot modify a completed attempt's persisted score, timing or XP.
- Expired attempts are marked `EXPIRED` and cannot create sessions or XP history.
- Cross-user attempts and sources are rejected.
- Remote LLM availability is not required to validate score/XP integrity; critical tests use deterministic persisted fixtures and disposable PostgreSQL.

## Verification

`frontend/tests/exam-timing.test.mjs` proves the pure claim/deadline contract, including click/timeout races, rapid repeated input, countdown boundaries and fail-closed invalid inputs. CI runs this suite explicitly. `frontend/e2e/tests/exam-race.spec.ts` exercises the production component by dispatching two synchronous clicks to the same rendered answer control and requiring exactly one question transition.

`frontend/tests/gamification-concurrency.test.mjs` covers valid scoring and adversarial server paths including forged correctness/difficulty/source data, sequential lost-response retry, tampered retry, concurrent convergence, expiry, malformed submissions, cross-user isolation and the daily XP cap. CI applies migrations to empty PostgreSQL 16, verifies migration history/schema parity, and then runs the ownership and gamification suites.
