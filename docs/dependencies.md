# Dependency verification

StudyFlash validates frontend dependencies from the committed npm lockfile and backend dependencies from a committed Python version lock.

## Python backend

`requirements.in` is the small, human-maintained list of direct backend dependency intent. `requirements.txt` is the resolved release lock consumed by CI, Clean Room, and local setup. Every installable line in the release lock is exact-version pinned; backend tests fail if an unconstrained entry is reintroduced or if a direct dependency disappears from the lock.

The required backend CI job audits that complete lock with `pypa/gh-action-pip-audit` pinned to an immutable commit SHA and `no-deps: true`, so vulnerability scanning evaluates the exact committed graph rather than resolving a second graph. A discovered vulnerability fails the already-required `Backend syntax and deterministic tests` context; the scanner is not an advisory-only side job.

Update the backend graph deliberately: change `requirements.in`, resolve a complete Python 3.12 dependency graph in a clean environment, replace `requirements.txt`, review the dependency and vulnerability-scan diff, and require the full release matrix before promotion. Do not hand-wave a successful `pip install` of unconstrained names as deterministic evidence.

PyMuPDF is imported through its supported `pymupdf` module name; the legacy `fitz` alias is not part of the application contract.

## Frontend

The CI pipeline uses `npm ci`, records complete and production-only npm audit reports as GitHub Actions artifacts, and treats unresolved high-severity production findings as a review blocker.

### Package placement

`@ducanh2912/next-pwa` is build-time tooling used by the Next.js configuration to generate the service worker, so it is maintained in `devDependencies` rather than the deployed runtime dependency set.

Prisma runtime packages and the Prisma CLI are kept on an aligned 7.x release line so generated clients, migrations and the PostgreSQL driver adapter are validated together.

For dependency updates, verification includes exact lockfile installs, lint, TypeScript checks, PostgreSQL integration tests, backend tests, dependency audits, production build, and final diff review.

Temporary lockfile-maintenance helpers are not part of the integration deliverable.
