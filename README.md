# StudyFlash

StudyFlash is an AI-assisted study application for turning user-provided text and PDF material into structured study content such as flashcards, study plans, and practice questions.

## Status

**Active engineering professionalization.**

This repository is under active hardening and is **not release-certified**. Release certification remains in progress and requires the project’s real CI, browser E2E, integrity, accessibility, PWA/offline, documentation, clean-room, and independent adversarial gates to complete successfully.

The default branch, `main`, remains the current trunk. Ongoing professionalization work is integrated separately through `portfolio/revamp-2026`; that integration branch must not be treated as a final release or promoted to `main` without the required certification process.

## Architecture

StudyFlash is split into two primary application layers:

- **Frontend:** Next.js, React, TypeScript, Tailwind CSS, Clerk authentication, Prisma, and PostgreSQL.
- **Backend / AI boundary:** FastAPI, PyMuPDF, LangChain, and Groq-backed model integration.

The professionalization work also maintains automated unit/integration checks and Playwright browser E2E coverage in the integration line.

## Current validation scope

Several capabilities are still being actively validated. In particular, **PWA/offline behavior is under active validation** and should not be interpreted as a release-grade guarantee until the corresponding certification work is complete.

AI-generated study material may be incomplete or incorrect and should be reviewed by the user before being relied on for learning or assessment.

## Security and privacy

Secrets and credentials belong in local/runtime environment configuration and must never be committed to the repository. Test data and automated browser fixtures are intended to be synthetic.

See the project backlog and `[PROGRAM] Portfolio Professionalization` issue for the active engineering/certification ledger.

## Changelog

Historical development notes are available in [CHANGELOG.md](./CHANGELOG.md). Earlier entries may describe capabilities that are currently being revalidated as part of the professionalization program.

## License status

**No license policy has been selected yet.** Until the maintainer makes an explicit licensing decision, do not assume permission to use, copy, modify, or redistribute this code.

The repository should not be made public as part of the current pre-publication process until the maintainer deliberately selects the intended licensing policy.