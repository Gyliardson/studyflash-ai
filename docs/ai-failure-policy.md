# StudyFlash AI latency and failure policy

StudyFlash treats the FastAPI service as a server-only AI boundary. Remote provider failures must be bounded in time, classified at the backend, and translated to stable user-facing behavior without exposing provider response bodies or exception text.

## Timeout budgets

Default nested budgets are:

- Groq provider request: **8 seconds** (`AI_PROVIDER_TIMEOUT_SECONDS`);
- exam AI caller before deterministic local fallback: **10 seconds**;
- plan/topic Server Actions: **12 seconds**;
- PDF Next.js proxy: **15 seconds**.

The inner provider timeout must remain shorter than outer application deadlines. The provider adapter sets SDK `max_retries=0`; StudyFlash owns retry/fallback policy explicitly. The backup Groq model is attempted at most once and only when the primary model is rate-limited.

`AI_PROVIDER_TIMEOUT_SECONDS` is configurable for backend operations, but changing it requires reviewing the outer budgets above. Values outside the accepted range fall back to the default rather than creating an effectively unbounded provider request.

## Backend failure contract

FastAPI maps StudyFlash AI-domain failures to stable HTTP semantics:

- invalid caller input: `422`;
- provider rate/capacity limit: `429`;
- malformed/contract-invalid structured provider output: `502`;
- provider unavailable/transient upstream failure: `503`;
- provider timeout: `504`;
- unexpected internal defects: `500`.

Responses use static StudyFlash messages. Provider exception text, response bodies, prompts, credentials, and secret headers are not copied into error responses. Backend logs record only the operation and exception type for these failures.

## Next.js caller behavior

Plan and topic generation have explicit abort deadlines and return static messages based on the backend status. The PDF proxy has its own outer deadline and otherwise preserves the backend's safe status/body.

Exam generation intentionally has a deterministic local fallback because plausible distractors can be derived from the user's existing flashcards. Fallback is allowed only for network/timeout/provider failures (`429`, `502`, `503`, `504`, or other `5xx`). Authorization, malformed caller requests, and other `4xx` contract failures are not silently converted into a successful local result.

## Deterministic validation

CI must validate this contract without any remote LLM call. Unit tests cover provider fallback cardinality, timeout/error classification, HTTP mappings, nested frontend budgets, fallback eligibility, and non-leakage of synthetic private exception text.
