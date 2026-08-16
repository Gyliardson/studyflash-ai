# StudyFlash clean-room verification

This document defines the reproducible release-bootstrap proof for StudyFlash. The authoritative automated implementation is `.github/workflows/clean-room.yml`.

## Scope

A clean-room run starts from a fresh GitHub checkout and proves that no local dependency tree, generated Prisma client, Next.js build, environment file or Playwright authentication state is required to bootstrap the repository.

The workflow uses only disposable/development infrastructure:

- Python 3.12;
- Node.js 22;
- PostgreSQL 16 running as a disposable GitHub Actions service;
- Clerk **development** E2E credentials stored as GitHub Actions secrets;
- a synthetic server-only `STUDYFLASH_INTERNAL_API_KEY` used only inside the runner;
- no production Neon connection;
- no production Clerk project;
- no remote LLM as a critical verification dependency.

Application dependency versions are source-controlled: the frontend/E2E trees use npm lockfiles and the backend installs the exact versions recorded in `requirements.txt`, whose direct dependency intent is maintained separately in `requirements.in`. Hosted-runner image internals are recorded by the run and are not claimed to be bit-for-bit reproducible outside GitHub Actions.

The disposable PostgreSQL service intentionally follows the maintained `postgres:16` patch line instead of freezing one patch digest indefinitely. This keeps CI on current PostgreSQL 16 security/bugfix releases while migrations and domain behavior are revalidated from an empty database on every candidate. The exact server/client versions are visible in each run's service/tool logs; StudyFlash does not claim an immutable container image here.

## Fresh-state assertions

Immediately after `actions/checkout`, the workflow requires the absence of:

- `.venv`;
- root/frontend/E2E `node_modules`;
- `frontend/.next`;
- local `.env` / `frontend/.env.local` files;
- `frontend/e2e/.auth` and checked-out browser storage state.

A failure here means the repository accidentally depends on generated or local state and the clean-room gate must fail.

## Bootstrap and verification order

1. Record the exact Git SHA and Python/Node/npm/PostgreSQL client versions.
2. Install the exact backend dependency graph from `requirements.txt`; backend tests verify every installable lock entry uses `==` and every direct entry from `requirements.in` remains represented.
3. Compile the Python application and execute deterministic backend tests.
4. Start FastAPI with a synthetic internal key and require `GET /` to return successfully.
5. `npm ci` in `frontend/` and `frontend/e2e/`.
6. Generate Prisma client.
7. Apply all checked-in migrations to an empty PostgreSQL database.
8. Require `prisma migrate status` and schema-diff verification to pass.
9. Execute the current seed policy: **no repository seed is required**. Deterministic suites create their own synthetic fixtures; production-like personal data must not be invented or committed for this proof.
10. Run frontend lint and TypeScript typecheck.
11. Run deterministic frontend AI-failure tests plus ownership, gamification, retry/idempotency and timezone database suites.
12. Build the production Next.js application.
13. Install Chromium and run the Playwright desktop/mobile, authenticated/public, accessibility, study/exam/recovery and PWA matrix with Clerk development credentials.
14. Re-check the FastAPI health endpoint after the browser suite.
15. Upload clean-room logs and Playwright evidence keyed by the exact candidate SHA.

## Local reproduction

The same proof can be reproduced manually from a genuinely fresh clone. Do not copy an existing `.env`, browser storage state, `.next`, virtualenv or `node_modules` directory into the clone.

Backend, from repository root:

```bash
python -m venv .venv
source .venv/bin/activate  # Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m compileall -q app tests
python -m unittest discover -s tests -p 'test_*.py' -v
```

Frontend/database, from `frontend/` with an empty disposable PostgreSQL configured by `DATABASE_URL`:

```bash
npm ci
npm --prefix e2e ci
npx prisma generate
npm run db:migrate:deploy
npm run db:migrate:status
npm run db:schema:verify
npm run lint
npx tsc --noEmit
npm run build
npm --prefix e2e run install:chromium
npm run test:e2e
```

Authenticated Browser E2E additionally requires the documented Clerk development secrets. Never substitute production credentials merely to make this gate green.

## Release interpretation

A green clean-room workflow proves that the exact tested repository SHA can bootstrap from fresh state using its committed application dependency locks and pass the deterministic domain/browser matrix against disposable infrastructure. It does **not** claim that GitHub's hosted runner image or maintained PostgreSQL 16 patch tag is bit-for-bit immutable, and it does **not** by itself authorize promotion to `main`. Final promotion still requires repository governance/rulesets and the adversarial audit tracked by the professionalization program.
