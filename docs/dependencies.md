# Dependency verification

StudyFlash validates frontend dependencies from the committed npm lockfile.

The CI pipeline uses `npm ci`, records complete and production-only npm audit reports as GitHub Actions artifacts, and treats unresolved high-severity production findings as a review blocker.

For dependency updates, verification includes the exact lockfile install, lint, TypeScript checks, PostgreSQL integration tests, backend tests, production audit review, production build, and final diff review.

Temporary lockfile-maintenance helpers are not part of the integration deliverable.
