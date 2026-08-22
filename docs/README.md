# StudyFlash documentation

This directory is the canonical technical-documentation hub for StudyFlash. The root [`README.md`](../README.md) is the public English landing page; localized landing pages live under [`i18n/`](i18n/).

Documentation is grouped by the contract it describes rather than by implementation language.

## Architecture

System boundaries, infrastructure, persistence, and PWA data semantics.

- [`architecture/AI.md`](architecture/AI.md) — production AI provider, model/data boundary, and non-capabilities.
- [`architecture/DATABASE.md`](architecture/DATABASE.md) — PostgreSQL/Prisma architecture, migration policy, Neon target, and clean database bootstrap.
- [`architecture/PWA_OFFLINE_CONTRACT.md`](architecture/PWA_OFFLINE_CONTRACT.md) — cache strategy and network-authoritative protected-data contract.

## Correctness

Behavioral invariants that protect user intent, scoring, retries, and time-based product state.

- [`correctness/AI_FAILURE_POLICY.md`](correctness/AI_FAILURE_POLICY.md) — bounded provider timeouts, failure classification, and application fallback rules.
- [`correctness/CONTENT_CREATION_IDEMPOTENCY.md`](correctness/CONTENT_CREATION_IDEMPOTENCY.md) — mutation identity, durable receipts, replay semantics, and concurrent-create boundaries.
- [`correctness/EXAM_INTEGRITY.md`](correctness/EXAM_INTEGRITY.md) — server-authoritative exam attempts, scoring, and replay-safe finalization.
- [`correctness/GAMIFICATION_TIME_POLICY.md`](correctness/GAMIFICATION_TIME_POLICY.md) — canonical calendar timezone and daily XP/streak boundaries.

## Operations

Reproducible setup, deployment, and portfolio-evidence handling.

- [`operations/CLEAN_ROOM.md`](operations/CLEAN_ROOM.md) — fresh-checkout bootstrap and deterministic candidate proof.
- [`operations/DEPLOY.md`](operations/DEPLOY.md) — production topology, required configuration, database provisioning, and rollback principles.
- [`operations/MEDIA.md`](operations/MEDIA.md) — screenshot capture policy, exact artifact provenance, restored PNG inventory, validation hashes, and public-presentation boundary.

## Assurance

Repository-level dependency and promotion controls.

- [`assurance/DEPENDENCIES.md`](assurance/DEPENDENCIES.md) — Python/npm lock and vulnerability-verification policy.
- [`assurance/GOVERNANCE.md`](assurance/GOVERNANCE.md) — exact-SHA checks, current promotion topology, ruleset expectations, and supply-chain policy.

## Security and legal authorities

- [`../SECURITY.md`](../SECURITY.md) is authoritative for vulnerability reporting and disclosure expectations.
- [`../LICENSE`](../LICENSE) is authoritative for legal use. StudyFlash is publicly visible but proprietary and is **not open source**.

## Localized landing pages

The root English README is canonical. The following pages are natural-language equivalents of its public product/engineering presentation; technical guarantees, limitations, AI/privacy boundaries, and license meaning must remain semantically aligned. The canonical README owns the visual screenshot presentation so the translated pages do not duplicate large media embeds; screenshot provenance remains language-independent in [`operations/MEDIA.md`](operations/MEDIA.md).

- [English](../README.md)
- [Português](i18n/pt-BR/README.md)
- [日本語](i18n/ja/README.md)
- [Español](i18n/es/README.md)

## Documentation maintenance rule

When implementation changes a documented guarantee, update the narrowest authoritative contract and its tests in the same engineering change. Landing pages should summarize proven behavior and link to those contracts rather than inventing stronger guarantees. When documentation paths move, update repository-relative references before removing the old path.
