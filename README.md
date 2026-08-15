# StudyFlash

StudyFlash is an AI-assisted study application for turning source material into flashcards, spaced-review sessions, study plans and server-authoritative exams.

The portfolio version is being hardened around reproducible PostgreSQL migrations, authenticated ownership boundaries, deterministic critical tests, bounded AI failure semantics, accessibility and recoverable/idempotent mutations.

## What is implemented

- Flashcard generation from text and PDF through a protected FastAPI AI boundary.
- Decks, study plans and topic-based material organization.
- Spaced repetition with resumable study sessions and server-authoritative XP/streak updates.
- Exam attempts with persisted server-side question snapshots, server-authoritative scoring and idempotent finalization.
- Retry-safe content creation: repeated ambiguous saves converge without duplicate cards/plans/topic content or duplicate creation XP.
- Clerk authentication and owner-scoped PostgreSQL access.
- Installable PWA shell with an explicit network-authoritative offline policy.
- Desktop/mobile browser coverage with Playwright and serious/critical Axe accessibility gates.

## Architecture

```text
Browser
  |
  v
Next.js 16 / React 19
  |  Clerk auth + Server Actions / same-origin routes
  |  Prisma 7
  +---------------------------> PostgreSQL
  |
  | X-StudyFlash-Internal-Key (server only)
  v
FastAPI
  |
  v
AIProvider abstraction
  +--> real provider in production
  +--> deterministic fake/provider policy in critical tests
```

The browser never receives the internal FastAPI credential and should not call the AI backend directly. PostgreSQL is configured through `DATABASE_URL`; production targets Neon, while local development, CI and Browser E2E use ordinary disposable PostgreSQL rather than production infrastructure.

## Repository map

- `frontend/` — Next.js application, Prisma schema/migrations and Playwright project.
- `app/` — FastAPI AI service.
- `tests/` — deterministic backend tests.
- `docs/` — focused architecture, database, AI, PWA and correctness contracts.
- `.github/workflows/` — deterministic CI, Browser E2E and integrity gates.
- `security/` — reviewed dependency-security policy evidence.

## Local setup

### Prerequisites

- Node.js 22
- Python 3.12
- PostgreSQL 16-compatible database
- a Clerk **development** project for authenticated local/browser flows

Do not use production Clerk, Neon or AI credentials for tests.

### 1. Backend

From the repository root:

```bash
python -m venv .venv
# Linux/macOS: source .venv/bin/activate
# Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

Required backend environment names are documented in `.env.example`:

- `GROQ_API_KEY` — server-only real provider credential; not required by deterministic critical tests.
- `STUDYFLASH_INTERNAL_API_KEY` — server-only shared credential expected from the Next.js server.
- `AI_PROVIDER_TIMEOUT_SECONDS` — provider timeout policy.
- `CORS_ORIGINS` — explicit allowed development/browser origins.
- `MAX_PDF_BYTES` — PDF upload size ceiling.

### 2. Frontend and database

```bash
cd frontend
npm ci
cp .env.example .env.local
npx prisma generate
npm run db:migrate:deploy
npm run db:migrate:status
npm run db:schema:verify
npm run dev
```

Frontend environment names:

- `DATABASE_URL` — canonical PostgreSQL runtime + Prisma CLI connection string.
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — public Clerk development/project identifier.
- `CLERK_SECRET_KEY` — server-only Clerk credential.
- `AI_API_URL` — server-only FastAPI origin, normally `http://127.0.0.1:8000` locally.
- `STUDYFLASH_INTERNAL_API_KEY` — server-only value matching the backend.

Never prefix `AI_API_URL` or `STUDYFLASH_INTERNAL_API_KEY` with `NEXT_PUBLIC_`.

## Verification

Representative deterministic checks:

```bash
# backend, from repo root
python -m compileall -q app tests
python -m unittest discover -s tests -p 'test_*.py' -v

# frontend, from frontend/
npm run lint
npx tsc --noEmit
npm run build
npm run db:migrate:status
npm run db:schema:verify
```

Database-backed CI additionally runs ownership, gamification, retry/idempotency and timezone-boundary suites against disposable PostgreSQL. Browser E2E applies the checked-in migrations to an empty database, builds the production frontend and exercises public/authenticated, accessibility, study, exam, mutation recovery and PWA paths.

Critical gates do **not** depend on a remote LLM. See [`docs/ai.md`](docs/ai.md) and [`docs/ai-failure-policy.md`](docs/ai-failure-policy.md).

## Correctness and security contracts

- Database / Neon migration policy: [`docs/database.md`](docs/database.md)
- AI provider and server-only trust boundary: [`docs/ai.md`](docs/ai.md)
- Bounded AI failure behavior: [`docs/ai-failure-policy.md`](docs/ai-failure-policy.md)
- Exam integrity / exactly-once finalization: [`docs/exam-integrity.md`](docs/exam-integrity.md)
- Retry-safe content creation: [`docs/content-creation-idempotency.md`](docs/content-creation-idempotency.md)
- StudyFlash calendar/streak policy: [`docs/gamification-time-policy.md`](docs/gamification-time-policy.md)
- PWA/offline contract: [`docs/pwa-offline-contract.md`](docs/pwa-offline-contract.md)
- Dependency-security policy: [`docs/dependencies.md`](docs/dependencies.md)
- Deployment/operator notes: [`docs/deploy.md`](docs/deploy.md)
- Portfolio media provenance/capture policy: [`docs/media.md`](docs/media.md)
- Vulnerability disclosure policy: [`SECURITY.md`](SECURITY.md)

## PWA / offline scope

StudyFlash is installable, but authenticated study data and mutations remain network-authoritative. The service worker must not silently queue authenticated writes or present stale protected data as authoritative. See [`docs/pwa-offline-contract.md`](docs/pwa-offline-contract.md) for the exact proven behavior.

## Deployment model

The intended production topology is:

- Next.js frontend/server: Vercel-compatible deployment.
- FastAPI AI service: independent Python service.
- PostgreSQL: Neon via `DATABASE_URL`.
- Authentication: Clerk.

Deployments must provision migrations separately from application startup and keep the Next.js → FastAPI shared credential server-only. The repository does not require CI to connect to production Neon. See [`docs/deploy.md`](docs/deploy.md).

## Portfolio evidence

Deterministic Playwright runs generate desktop/mobile product screenshots and preserve Browser E2E reports/artifacts in GitHub Actions. The curated repository copies below come from synthetic Browser E2E candidate `0fdda9a71a9c23ec77d63d4ce31c195ef9605c95`, which passed CI #561, Study Session Integrity #276 and Browser E2E #405 before visual inspection and curation. Full provenance and refresh rules are documented in [`docs/media.md`](docs/media.md).

### Desktop — create study material

![StudyFlash desktop creation flow](docs/media/create-flashcards-desktop-light.webp)

### Mobile — profile and progress

![StudyFlash mobile profile and progress](docs/media/profile-mobile-light.webp)

## Security and license

Please report vulnerabilities according to [`SECURITY.md`](SECURITY.md) and avoid publishing credentials, personal data or exploit details in public issues.

StudyFlash is publicly visible for portfolio and evaluation purposes but is **not open source**. The repository is distributed under the proprietary terms in [`LICENSE`](LICENSE); third-party dependencies retain their own licenses.

## Project status

The professionalization work is staged on `portfolio/revamp-2026`. `main` is not automatically promoted. Final promotion requires clean-room verification, governance checks and an adversarial audit of the complete integration diff.

Historical changelog entries describe earlier project states and should not be interpreted as stronger guarantees than the current documented contracts and tests.
