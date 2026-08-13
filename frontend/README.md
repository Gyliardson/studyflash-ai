# StudyFlash Frontend

Next.js frontend for StudyFlash.

## Local development

Install dependencies and start the development server:

```bash
npm ci
npm run dev
```

The application is available at `http://localhost:3000` by default.

## AI backend boundary

Browser code must not call the FastAPI AI service directly and must never receive the internal backend credential. AI requests are routed through authenticated Next.js server code, which forwards them to FastAPI.

Configure these variables only in the server environment:

```env
AI_API_URL=http://127.0.0.1:8000
STUDYFLASH_INTERNAL_API_KEY=replace-with-a-random-secret-at-least-32-characters
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

Database-backed integration checks require the repository test environment and PostgreSQL configuration described by the root project documentation/CI workflow.
