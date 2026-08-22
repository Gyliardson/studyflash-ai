# StudyFlash database and migration policy

## Current architecture

StudyFlash uses PostgreSQL through Prisma and `@prisma/adapter-pg`. `DATABASE_URL` is the canonical connection variable for both application runtime and Prisma CLI commands.

Production hosting target: **Neon PostgreSQL**.

Local development and CI: ordinary disposable PostgreSQL. Tests and migrations must never require production Neon credentials.

## Supabase inventory

Repository inspection on the current portfolio integration baseline found no active Supabase SDK/client dependency in the frontend or Python backend. Authentication is handled by Clerk, database access is direct PostgreSQL via Prisma/`pg`, and no active Supabase Storage, Realtime, Edge Functions or Supabase-specific API integration was found in the current application code/configuration.

Historical changelog references to Supabase describe an earlier hosting state and should remain intact as history. They are not the current runtime contract.

Classification:

| Capability | Current StudyFlash usage |
| --- | --- |
| PostgreSQL Database | Active, but accessed through standard PostgreSQL/Prisma; production target is Neon |
| Auth | No active Supabase usage; Clerk is authoritative |
| Storage | No active usage found |
| Realtime | No active usage found |
| Edge Functions | No active usage found |
| Supabase-specific APIs | No active usage found |
| Other | No active usage found |

If future repository evidence contradicts this inventory, update this document before removing or migrating the newly discovered dependency.

## Clean-room setup

From `frontend/`, with an empty PostgreSQL database:

```bash
npm ci
npx prisma generate
npm run db:migrate:deploy
npm run db:migrate:status
npm run db:schema:verify
```

`db:migrate:status` verifies migration history/accounting. `db:schema:verify` separately compares the configured PostgreSQL database with `prisma/schema.prisma` and fails when schema drift remains. CI runs both checks because successful migration deployment alone does not prove that the resulting database exactly matches the Prisma schema.

After these checks, run the normal integration tests against the same disposable database.

`prisma db push` is not the authoritative schema bootstrap once migration history is present.

## Baseline migration and existing databases

The migration `20260813142000_baseline` represents the Prisma schema that existed when checked-in migration history was introduced.

For a brand-new empty PostgreSQL database, apply it normally with `prisma migrate deploy`, then run `npm run db:schema:verify` before treating the database as current.

For an already-populated production database that predates checked-in migration history, **do not run the baseline migration blindly**. First verify the live schema matches the baseline. Only after verification should the migration be marked as already applied, for example:

```bash
npx prisma migrate resolve --applied 20260813142000_baseline
```

That command changes migration bookkeeping; it does not migrate or repair an incompatible schema. If production differs from the baseline, stop and prepare an explicit reconciliation migration/plan before changing production state.

## Neon provisioning

External Neon project/database creation is intentionally a manual infrastructure step unless a separately reviewed deployment automation is introduced.

Minimum production setup:

1. provision a Neon PostgreSQL database;
2. obtain the application connection string;
3. configure it as server-side `DATABASE_URL` in the deployment environment;
4. verify a backup/recovery point before the first migration of existing production data;
5. run `prisma migrate status` against the intended database;
6. baseline an existing matching schema when necessary, otherwise run `prisma migrate deploy`;
7. run `npm run db:schema:verify` and resolve any unexpected drift before application deployment;
8. deploy the application only after migration verification succeeds.

Never put a production connection string in GitHub Actions test jobs or committed files.

## Recovery expectations

Before production schema changes, create or verify the provider's recovery/backup capability and review the generated SQL. Prisma migration files are forward migration history, not an automatic data rollback mechanism. A destructive or data-transforming migration must include an explicit backup/recovery plan before deployment.

## Seed policy

The current schema does not require seed data for the ownership and gamification integration suite: tests create isolated fixtures explicitly. No production user data or personal data should be encoded in a repository seed. If deterministic catalog/reference data becomes required later, add an idempotent seed command and exercise it in CI.
