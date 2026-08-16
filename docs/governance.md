# Repository governance and promotion policy

StudyFlash uses a staged promotion model. GitHub is the authoritative record of code, reviews, checks, artifacts, and release evidence.

## Promotion path

Normal engineering changes follow:

`main` -> `portfolio/revamp-2026` -> `work/<issue>-<slug>` -> pull request -> `portfolio/revamp-2026`.

`main` is the release branch. `portfolio/revamp-2026` is the controlled integration branch. Work branches must not bypass the integration pull-request path. The final integration-to-`main` pull request is created only after clean-room validation, governance reconciliation, and the independent adversarial release audit. Automation must never merge that final pull request.

Before final certification, the integration candidate must also contain the current `main` history. If `main` advances independently while professionalization is in progress, reconcile that history through a reviewed work-branch pull request, resolve overlapping release-facing files deliberately, and re-run the exact-SHA deterministic matrix. Do not defer branch divergence or conflict resolution to the final `portfolio/revamp-2026` -> `main` pull request, because that would create an unvalidated merge result.

## Required deterministic evidence

The release candidate must be validated at its exact head SHA. The eight deterministic workflow gates are:

- `Secret Scan / Git history secret scan`
- `CI / Frontend lint, typecheck and build`
- `CI / Frontend dependency security`
- `CI / Ownership and gamification (PostgreSQL)`
- `CI / Backend syntax and deterministic tests`
- `Study Session Integrity / Study review retry and resume (PostgreSQL)`
- `Browser E2E / Public, auth and accessibility browser gates`
- `Clean Room Release Proof / Fresh clone bootstrap and full deterministic matrix`

Protected promotion branches require one additional base-specific status context that validates the promotion source/topology in GitHub's control plane:

- `Trusted promotion source policy (main)` when the pull request base is `main`;
- `Trusted promotion source policy (portfolio/revamp-2026)` when the pull request base is `portfolio/revamp-2026`.

Therefore each protected promotion ruleset currently requires nine status contexts: the eight deterministic workflow gates above plus the corresponding trusted-promotion source-policy context. The trusted-promotion context is not a ninth test workflow and must not be replaced by documentation or by an untrusted status with the same display intent.

A moved head invalidates evidence from the previous SHA. The same deterministic matrix is rechecked after internal merges to `portfolio/revamp-2026`. Remote LLM availability is deliberately excluded from merge eligibility; critical AI behavior is tested through deterministic provider/failure-policy coverage.

Browser E2E uses standard `pull_request` events. The secret-bearing authenticated Clerk job is restricted to pushes and same-repository pull requests, so untrusted fork code must not receive repository development secrets.

## Enforced GitHub control plane

The repository currently enforces this process with active repository rulesets for both protected promotion branches.

### `main`

`Protect main` applies to the default branch and:

1. requires changes through pull requests;
2. blocks deletion and non-fast-forward updates;
3. requires the eight deterministic workflow checks listed above plus `Trusted promotion source policy (main)`, with strict up-to-date semantics;
4. requires review-thread resolution before merge;
5. has no bypass actors configured.

### `portfolio/revamp-2026`

`Protect portfolio integration` applies specifically to `refs/heads/portfolio/revamp-2026` and:

1. requires normal integration changes through pull requests from work branches;
2. blocks deletion and non-fast-forward updates;
3. requires the eight deterministic workflow checks listed above plus `Trusted promotion source policy (portfolio/revamp-2026)`, with strict up-to-date semantics;
4. requires review-thread resolution before merge;
5. has no bypass actors configured.

The exact required-status contexts come from successful GitHub check runs and commit statuses rather than workflow filenames alone. A live remote LLM is not a required status check.

## Supply-chain policy

Security-sensitive GitHub-owned actions in the release workflows are pinned to immutable commit SHAs. Human-readable major-version comments are retained beside the pins. Upgrades must deliberately move the SHA after reviewing the upstream release; floating major tags are not the trust anchor.

The workflows use least-privilege `contents: read` permissions unless a future job demonstrates a narrower additional permission is necessary.

The `Secret Scan` workflow checks Git history with full checkout depth and a SHA-pinned Gitleaks action. Secret scanning is a required release gate rather than an advisory-only workflow.

## Vulnerability reporting

GitHub Private Vulnerability Reporting is enabled for the repository and is the preferred disclosure path. `SECURITY.md` directs reporters to GitHub's private vulnerability-reporting flow and retains a private maintainer-contact fallback if that repository-native channel is temporarily unavailable.

Security reports must not be opened as public issues when they contain exploit details, credentials, personal data, or reproducible attack payloads.

## Repository metadata

The public repository description is reconciled with the current product and stack:

> StudyFlash - AI-powered study platform for flashcards, spaced repetition, and practice exams; built with Next.js, FastAPI, PostgreSQL/Neon, and Clerk.

Legacy provider-specific positioning is no longer used as the repository description.

## Verification rule

Source documentation is not sufficient evidence for governance state. Final certification must re-read the active rulesets, required checks, Private Vulnerability Reporting state, repository metadata, exact candidate SHA, and corresponding successful checks from GitHub.
