# StudyFlash Frontend

Next.js frontend for StudyFlash.

## Local development

Install dependencies and configure the environment:

```bash
npm ci
cp .env.example .env.local
```

Use a local/disposable PostgreSQL database through `DATABASE_URL`, then initialize it with checked-in migrations:

```bash
npx prisma generate
npm run db:migrate:deploy
npm run db:migrate:status
npm run dev
```

The application is available at `http://localhost:3000` by default.

`DATABASE_URL` is the canonical PostgreSQL variable for both runtime access and Prisma CLI operations. Production targets Neon PostgreSQL; local development and CI must use ordinary local/disposable PostgreSQL and must not depend on production Neon credentials.

The repository migration/baselining policy, Supabase inventory and Neon provisioning notes are documented in [`../docs/database.md`](../docs/database.md).

## AI backend boundary

Browser code must not call the FastAPI AI service directly and must never receive the internal backend credential. AI requests are routed through authenticated Next.js server code, which forwards them to FastAPI.

Configure these variables only in the server environment:

```env
AI_API_URL=http://127.0.0.1:8000
STUDYFLASH_INTERNAL_API_KEY=<server-only-shared-secret>
```

`AI_API_URL` identifies the FastAPI service from the Next.js server. `STUDYFLASH_INTERNAL_API_KEY` is a shared server-to-server credential and must use the same value in the FastAPI environment. Do not prefix either variable with `NEXT_PUBLIC_`.

The backend currently requires `X-StudyFlash-Internal-Key` on protected AI endpoints; the frontend server helper injects that header. Client components should call same-origin Next.js routes or Server Actions instead of constructing FastAPI URLs.

## Quality gates

Run the frontend checks used by CI before merging changes:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Database-backed integration checks require PostgreSQL initialized through `npm run db:migrate:deploy`. `prisma db push` is not the authoritative clean-room bootstrap once migration history is present.
