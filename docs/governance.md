# Repository governance and promotion policy

StudyFlash uses a staged promotion model. GitHub is the authoritative record of code, reviews, checks, artifacts, and release evidence.

## Promotion path

Normal engineering changes follow:

`main` -> `portfolio/revamp-2026` -> `work/<issue>-<slug>` -> pull request -> `portfolio/revamp-2026`.

`main` is the release branch. `portfolio/revamp-2026` is the controlled integration branch. Work branches must not bypass the integration pull-request path. The final integration-to-`main` pull request is created only after clean-room validation, governance reconciliation, and the independent adversarial release audit. Automation must never merge that final pull request.

## Required deterministic evidence

The release candidate must be validated at its exact head SHA. The intended required gates are:

- `CI / Frontend lint, typecheck and build`
- `CI / Frontend dependency security`
- `CI / Ownership and gamification (PostgreSQL)`
- `CI / Backend syntax and deterministic tests`
- `Study Session Integrity / Study review retry and resume (PostgreSQL)`
- `Browser E2E / Public, auth and accessibility browser gates`
- `Clean Room Release Proof / Fresh clone bootstrap and full deterministic matrix`

A moved head invalidates evidence from the previous SHA. The same deterministic matrix is rechecked after internal merges to `portfolio/revamp-2026`. Remote LLM availability is deliberately excluded from merge eligibility; critical AI behavior is tested through deterministic provider/failure-policy coverage.

Browser E2E uses standard `pull_request` events. The secret-bearing authenticated Clerk job is restricted to pushes and same-repository pull requests, so untrusted fork code must not receive repository development secrets.

## GitHub settings target

The repository control plane should enforce the process above rather than relying only on convention.

### `main`

Create a branch ruleset or equivalent branch protection that:

1. requires changes through pull requests;
2. blocks normal direct pushes and force pushes;
3. requires the deterministic checks listed above once their exact GitHub check contexts are confirmed on the final candidate;
4. requires the branch to be current with the protected base before merge, so stale checks cannot authorize a moved candidate;
5. preserves administrator emergency access only when intentionally configured and auditable.

### `portfolio/revamp-2026`

Create a ruleset or equivalent branch protection that:

1. requires normal integration changes through pull requests from `work/*` branches;
2. blocks force pushes and accidental deletion;
3. requires the stable deterministic integration checks appropriate to the change, including Browser E2E and clean-room proof for release-gate changes;
4. never requires a live remote LLM.

The exact required-status contexts must be copied from successful GitHub check runs, not guessed from workflow filenames.

## Supply-chain policy

Security-sensitive GitHub-owned actions in the release workflows are pinned to immutable commit SHAs. Human-readable major-version comments are retained beside the pins. Upgrades must deliberately move the SHA after reviewing the upstream release; floating major tags are not the trust anchor.

The workflows use least-privilege `contents: read` permissions unless a future job demonstrates a narrower additional permission is necessary.

## Vulnerability reporting

GitHub Private Vulnerability Reporting is the preferred repository-native disclosure path and should be enabled in repository settings. Until it is verifiably enabled, `SECURITY.md` must not claim that it is available; reporters should use the documented private maintainer-contact path instead of publishing exploit details.

After enabling Private Vulnerability Reporting, update `SECURITY.md` to make that channel primary and record the setting in release evidence.

## Repository metadata

The public repository description should match the current product rather than legacy provider-specific framing. Recommended description:

> StudyFlash — plataforma de estudos com flashcards, revisão espaçada e simulados com IA; Next.js, FastAPI, PostgreSQL/Neon e Clerk.

This metadata is a GitHub control-plane setting. Source documentation must not claim it was changed until the repository setting itself is re-read and verified.

## Manual settings checklist

The following items require GitHub repository-settings access when automation cannot mutate them:

- create and verify the `main` ruleset/protection;
- create and verify the `portfolio/revamp-2026` ruleset/protection;
- confirm the exact required check contexts from successful candidate runs;
- enable Private Vulnerability Reporting and then reconcile `SECURITY.md`;
- replace the stale repository description;
- re-read rulesets/protection, vulnerability-reporting state, and repository metadata from GitHub and attach the observed result to issue #28.

Issue #28 remains open until these control-plane requirements are actually enforced. Documentation of a desired setting is not evidence that the setting exists.
