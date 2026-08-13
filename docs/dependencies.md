# Dependency verification

StudyFlash validates frontend dependencies from the committed npm lockfile.

The CI pipeline uses `npm ci`, records complete and production-only npm audit reports as GitHub Actions artifacts, and treats unresolved high-severity production findings as a review blocker.

## Package placement

`@ducanh2912/next-pwa` is build-time tooling used by the Next.js configuration to generate the service worker, so it is maintained in `devDependencies` rather than the deployed runtime dependency set.

Prisma runtime packages and the Prisma CLI are kept on an aligned 7.x release line so generated clients, migrations and the PostgreSQL driver adapter are validated together.

For dependency updates, verification includes the exact lockfile install, lint, TypeScript checks, PostgreSQL integration tests, backend tests, production audit review, production build, and final diff review.

Temporary lockfile-maintenance helpers are not part of the integration deliverable.
