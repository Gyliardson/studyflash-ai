# StudyFlash deployment runbook

This document describes the intended production topology and the minimum external provisioning that cannot be inferred safely from source code alone.

## Topology

- **Web/application server:** Next.js (`frontend/`).
- **AI service:** FastAPI (`app/`).
- **Database:** PostgreSQL through `DATABASE_URL`; production target is Neon.
- **Authentication:** Clerk.

The Next.js server is the trust boundary between browser code and FastAPI. Browser code must use same-origin routes/Server Actions and must never receive the FastAPI shared credential.

## Required production configuration

### Next.js server

- `DATABASE_URL` — production Neon PostgreSQL connection string.
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — public Clerk project key.
- `CLERK_SECRET_KEY` — server-only Clerk secret.
- `AI_API_URL` — server-only HTTPS origin of the deployed FastAPI service.
- `STUDYFLASH_INTERNAL_API_KEY` — server-only shared secret, identical to the FastAPI value.

### FastAPI service

- `GROQ_API_KEY` — real provider credential when Groq is the configured production provider.
- `STUDYFLASH_INTERNAL_API_KEY` — must match the Next.js server value.
- `AI_PROVIDER_TIMEOUT_SECONDS` — bounded provider timeout.
- `CORS_ORIGINS` — explicit allowed production web origin(s); do not use `*` with credentials.
- `MAX_PDF_BYTES` — PDF upload ceiling.

Do not commit real values. Do not expose server-only variables through `NEXT_PUBLIC_*` names.

## Database provisioning

1. Create a dedicated Neon project/database for StudyFlash production.
2. Copy its PostgreSQL connection string into the production `DATABASE_URL` secret.
3. From a controlled release environment, install the exact frontend lockfile and generate Prisma Client.
4. Run checked-in migrations:

```bash
cd frontend
npm ci
npx prisma generate
npm run db:migrate:deploy
npm run db:migrate:status
npm run db:schema:verify
```

5. Only after migration/status/schema verification succeeds should the application candidate receive production traffic.

Application startup must not rely on `prisma db push` as a replacement for the checked-in migration history. CI and Browser E2E use disposable PostgreSQL and must not connect to production Neon.

See [`../architecture/DATABASE.md`](../architecture/DATABASE.md) for migration history and the Supabase → PostgreSQL/Neon inventory.

## Clerk provisioning

Create/configure the production Clerk application outside the repository and inject its public/secret keys into the Next.js deployment. Browser E2E uses separate development credentials; production credentials are not test fixtures.

Review Clerk allowed origins/redirects for the final production hostname before launch.

## FastAPI deployment

A minimal production command is equivalent to:

```bash
uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
```

The hosting platform may wrap Uvicorn differently, but it must:

- install `requirements.txt` reproducibly;
- inject server-only environment variables;
- expose HTTPS to the Next.js deployment;
- preserve the configured provider/request timeouts;
- avoid logging API keys, provider response bodies or user source material.

Protected AI endpoints require `X-StudyFlash-Internal-Key`; requests without the matching configured secret must fail closed.

## Next.js deployment

Install/build from `frontend/` with the lockfile:

```bash
npm ci
npx prisma generate
npm run build
npm run start
```

For Vercel-style deployment, configure the project root/build settings so commands execute against `frontend/`, and inject the production server environment there. `AI_API_URL` must reference the deployed FastAPI origin, not `localhost`.

## Release verification

Before production promotion, require a clean candidate SHA and verify:

1. empty-database migrations, migration status and schema parity;
2. backend deterministic tests;
3. frontend lint, typecheck and production build;
4. ownership/gamification/idempotency PostgreSQL integration suites;
5. authenticated Browser E2E, accessibility and PWA/offline contracts;
6. dependency/secret/security gates;
7. health of the deployed frontend and FastAPI boundary with non-production smoke data.

A real-provider smoke test may be useful after secrets are provisioned, but it is optional evidence and must not replace deterministic critical gates.

## Rollback principles

- Roll back application code independently when a release introduces a runtime regression.
- Do not delete or rewrite user data automatically during rollback.
- Treat already-applied database migrations as durable history; corrective forward migrations are preferred to destructive ad-hoc rollback SQL.
- If a release changes an external secret or endpoint, restore the previous secret/config only through the hosting control plane, never by committing it.

## Manual steps intentionally outside automation

The repository cannot safely create or own the user’s production accounts. The minimum manual provisioning remains:

- create/select the Neon production database and store `DATABASE_URL`;
- create/select the Clerk production application and configure allowed production origins;
- provision the real AI provider credential;
- deploy/configure the FastAPI service and set its public HTTPS origin as `AI_API_URL` in Next.js;
- set the same high-entropy `STUDYFLASH_INTERNAL_API_KEY` on both server deployments;
- configure final production domains and hosting secrets.

These are deployment-control-plane actions, not CI responsibilities.
