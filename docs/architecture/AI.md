# AI provider boundary

StudyFlash keeps model-provider code behind `app.ai_provider.AIProvider`. Production inference uses Groq through `GroqAIProvider`.

## Production provider and models

- Provider: **Groq**.
- Primary model default: `openai/gpt-oss-120b`.
- Backup model default: `openai/gpt-oss-20b`.
- Provider SDK retries: `max_retries=0`.
- Default provider timeout: **8 seconds** via `AI_PROVIDER_TIMEOUT_SECONDS`.

For each generation request, the primary model is called once. The backup model is called once only when the primary failure is classified as rate-limit related. Timeout, provider-unavailable, malformed-output and other non-rate-limit failures do not automatically trigger the backup model. Structured provider output is parsed against the declared schema and then validated by StudyFlash domain checks before it is accepted by the API layer.

Production resolves `GroqAIProvider` lazily through `get_ai_provider()`. Importing the application or running deterministic tests does not construct a remote client and does not require a Groq credential.

## AI-assisted features

Remote generation is used for these bounded product surfaces:

- flashcards generated from study text, including text extracted from PDFs;
- study plans;
- topic cards;
- exam distractors/options generated from an existing flashcard question and correct answer.

Traditional application logic such as authentication, persistence, ownership checks, scoring, XP/streak updates, scheduling, idempotency, PWA behavior and local exam fallback selection is not described as AI merely because it participates in an AI-assisted flow.

## Data boundary

The production request path is:

```text
Browser
  -> Next.js
  -> FastAPI
  -> Groq
```

The browser does not call Groq directly and does not receive `GROQ_API_KEY` or the Next.js -> FastAPI internal credential.

Data sent for inference depends on the requested feature:

- **Flashcards from text:** user source text can be sent to Groq, bounded by the backend generation limit.
- **Flashcards from PDF:** the PDF binary is uploaded to FastAPI, where PyMuPDF extracts text. The current code sends the necessary bounded extracted text to the generation provider; it does **not** send the raw PDF binary to Groq.
- **Study plans:** the topic and requested difficulty are sent for generation.
- **Topic cards:** the plan/course title and topic title are sent for generation.
- **Exam generation:** the stored flashcard question/front and correct answer/back are sent so the model can generate alternative options.

Repository evidence does not show internal user IDs or server secrets being inserted into model prompts.

Third-party inference processing and model training are separate concepts. This repository proves the request boundary implemented by StudyFlash; it does not establish a provider-side Zero Data Retention guarantee, zero logging guarantee, or other retention promise that is not enforced by repository code.

## What is not implemented

The current repository does not contain project-owned implementations of:

- RAG;
- embeddings;
- a vector database;
- a semantic retrieval pipeline;
- fine-tuning;
- project-owned model training;
- local LLM inference;
- Ollama;
- multi-provider routing.

The primary/backup Groq model policy is bounded fallback within the same provider, not multi-provider routing.

## Configuration

Production Groq access uses the provider's standard `GROQ_API_KEY` environment variable. Never expose it through a `NEXT_PUBLIC_` variable or commit it to the repository.

`GROQ_PRIMARY_MODEL` and `GROQ_BACKUP_MODEL` are optional server-side overrides. When unset or blank, StudyFlash uses the defaults documented above. This allows a supported Groq model rotation without changing application code.

The existing `STUDYFLASH_INTERNAL_API_KEY` is a separate server-to-server authorization credential for the Next.js -> FastAPI boundary; it is not a model-provider credential.

## Tests

Critical CI tests use an injected scripted provider and make no remote model calls. They cover successful service behavior, invalid generated shapes, provider failure propagation, rate-limit fallback, timeout/non-rate-limit behavior, exhausted rate limits, and backup-provider unavailability. The fallback policy is bounded: the backup is attempted at most once and only after a rate-limit-classified primary failure.

A real-provider smoke test may be added separately, but it must remain optional/non-gating and require explicit local or deployment credentials.

## Failure semantics

Generated output is not considered valid merely because a provider returned it. In particular, an exam question must contain exactly four unique alternatives and must include the stored correct answer. Provider failure or invalid generated output is surfaced as an error at the backend boundary; downstream application fallback behavior is documented separately in [`../correctness/AI_FAILURE_POLICY.md`](../correctness/AI_FAILURE_POLICY.md).
