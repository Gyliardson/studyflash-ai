# StudyFlash AI latency and failure policy

StudyFlash treats the FastAPI service as a server-only AI boundary. Remote provider failures must be bounded in time, classified at the backend, and translated to stable user-facing behavior without exposing provider response bodies or exception text.

## Timeout budgets

Default nested budgets are:

- Groq provider request: **8 seconds** (`AI_PROVIDER_TIMEOUT_SECONDS`);
- exam AI caller before local application fallback: **10 seconds**;
- plan/topic Server Actions: **12 seconds**;
- PDF Next.js proxy: **15 seconds**.

The inner provider timeout must remain shorter than outer application deadlines. The provider adapter sets SDK `max_retries=0`; StudyFlash owns retry/fallback policy explicitly. The primary Groq model is called once. The backup Groq model is attempted at most once and only when the primary model failure is classified as rate limited. Timeout, unavailable-provider and other non-rate-limit primary failures do not automatically trigger the backup model.

`AI_PROVIDER_TIMEOUT_SECONDS` is configurable only within the bounded interval above zero and at most **9 seconds**, keeping an individual provider request below the 10-second exam fallback deadline. Invalid, non-positive, or larger values fall back to the 8-second default rather than creating an effectively unbounded or mis-nested request budget.

## Backend failure contract

FastAPI maps StudyFlash AI-domain failures to stable HTTP semantics:

- invalid caller input: `422`;
- provider rate/capacity limit: `429`;
- malformed/contract-invalid structured provider output: `502`;
- provider unavailable/transient upstream failure: `503`;
- provider timeout: `504`;
- unexpected internal defects: `500`.

Responses use static StudyFlash messages. Provider exception text, response bodies, prompts, credentials, and secret headers are not copied into error responses. Backend logs record only the operation and exception type for these failures.

Structured output is not accepted solely because the provider returned a response. Provider parsing/schema validation and StudyFlash domain validation reject malformed flashcard, plan, topic-card and exam-option shapes before the result is accepted by the application boundary.

## Next.js caller behavior

Plan and topic generation have explicit abort deadlines and return static messages based on the backend status. The PDF proxy has its own outer deadline and otherwise preserves the backend's safe status/body.

Exam generation intentionally has a **local application fallback** because plausible alternatives can be assembled from the user's existing flashcards when remote generation is unavailable. This fallback is traditional application logic, not another LLM and not a second inference provider. It reuses content already present in the flashcard set; runtime selection and shuffling may be randomized, so the fallback must not be described as deterministic.

Fallback is allowed only for network/timeout/provider failures (`429`, `502`, `503`, `504`, or other `5xx`). Authorization, malformed caller requests, and other `4xx` contract failures are not silently converted into a successful local result.

## Deterministic test policy

Critical CI validates the failure contract without any remote LLM call. Deterministic scripted providers, fixtures and assertions used by tests are testing mechanisms; they are distinct from the runtime exam fallback described above.

Unit tests cover provider fallback cardinality, timeout/error classification, structured-output shape failures, HTTP mappings, nested frontend budgets, local fallback eligibility, and non-leakage of synthetic private exception text.
