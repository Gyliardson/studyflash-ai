# AI provider boundary

StudyFlash keeps model-provider code behind `app.ai_provider.AIProvider`.

Production resolves `GroqAIProvider` lazily through `get_ai_provider()`. Importing the application or running deterministic tests does not construct a remote client and does not require a Groq credential. The provider uses the existing primary and backup Groq models; fallback is bounded to one backup attempt when the primary request is classified as rate limited.

Application services in `app/services.py` accept an injected provider for deterministic tests and otherwise resolve the production provider lazily. Domain validation remains outside the remote adapter: flashcard counts/content, study-plan topic counts, topic-card counts and exam alternative shape are validated before results are returned to API callers.

## Configuration

Production Groq access uses the provider's standard `GROQ_API_KEY` environment variable. Never expose it through a `NEXT_PUBLIC_` variable or commit it to the repository.

The existing `STUDYFLASH_INTERNAL_API_KEY` is a separate server-to-server authorization credential for the Next.js → FastAPI boundary; it is not a model-provider credential.

## Tests

Critical CI tests use an injected scripted provider and make no remote model calls. They cover successful service behavior, invalid generated shapes, provider failure propagation, rate-limit fallback, timeout/non-rate-limit behavior, exhausted rate limits, and backup-provider unavailability. The fallback policy is bounded: the backup is attempted at most once and only after a rate-limit-classified primary failure.

A real-provider smoke test may be added separately, but it must remain optional/non-gating and require explicit local or deployment credentials.

## Failure semantics

Generated output is not considered valid merely because a provider returned it. In particular, an exam question must contain exactly four unique alternatives and must include the stored correct answer. Provider failure or invalid generated output is surfaced as an error; StudyFlash does not silently convert it into a one-option multiple-choice question.
