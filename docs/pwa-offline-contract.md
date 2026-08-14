# StudyFlash PWA and offline contract

StudyFlash is installable, but it is **not an offline-first data application**. The service worker exists to provide the application shell/static assets and a deterministic offline boundary. User-owned HTML, RSC payloads, API reads and mutations remain server-authoritative.

## Cache policy

| Request / surface | Strategy | Offline behavior |
| --- | --- | --- |
| Next.js hashed static assets | Cache First, bounded | Reuse immutable build assets when present |
| Static product images/icons | Cache First, bounded | Reuse cached static media when present |
| HTML navigation, public or authenticated | Network Only | Show `/offline` if the network cannot answer |
| RSC/data/API GETs | Network Only | Fail; UI must not substitute stale authenticated data |
| Server Actions / POST mutations | Network only by browser; never runtime-cached | Operation remains unconfirmed and UI must not claim durable success |
| AI generation | Network only | Report network failure; no generated-success state |

`cacheOnFrontEndNav`, `aggressiveFrontEndNavCaching` and start-URL caching are disabled. This intentionally trades broad offline page replay for a safer account boundary: a second user on the same browser must never receive a prior user's cached dashboard/deck/study HTML or data.

## Route contract

Public routes such as `/`, `/termos` and `/privacidade` require the network for fresh documents. Once the production service worker controls the page, an uncached navigation without network receives the generic `/offline` document.

Authenticated routes (`/dashboard`, `/colecao`, deck detail, `/estudar`, `/simulado`, `/perfil` and study-plan routes) are also Network Only at the document/data layer. StudyFlash does not advertise previously visited authenticated pages as available offline.

## Mutations and reconnect

Offline review, deck/card, plan, exam and AI-generation operations are not queued by the service worker. The application only advances durable review/exam state after the existing server-authoritative action confirms persistence. Reconnect triggers a reload so the next rendered state is fetched from the server.

Duplicate safety is a server invariant, not a service-worker promise:

- study reviews use persisted session items and idempotent commit state;
- exam finalization is backed by persisted attempt state and replay-safe finalization;
- collection writes use authoritative mutation results and transactional persistence where implemented.

The Browser E2E suite must keep exercising those server invariants separately from the PWA cache tests.

## Update lifecycle

The generated Workbox service worker is build-versioned. `cleanupOutdatedCaches` removes obsolete Workbox-managed caches when a new worker activates. Runtime static caches are explicitly versioned (`studyflash-next-static-v1`, `studyflash-static-images-v1`) and bounded by entry count/age.

A future change to cache authenticated documents or data requires a separate security review that proves logout/session-switch cache eviction and user isolation before it can be enabled.

## Deterministic evidence

`frontend/e2e/tests/pwa.spec.ts` runs against `next build` + `next start` on desktop and mobile Chromium and verifies:

1. a production service worker reaches `ready` and controls the application;
2. the manifest has StudyFlash identity, standalone display, start URL and required icons;
3. an uncached offline navigation receives the explicit offline fallback;
4. visiting an authenticated dashboard does not leave dashboard/API/RSC/Clerk data in Cache Storage;
5. an offline authenticated revisit cannot render a stale dashboard.

This is the supported claim: **installable PWA with cached static assets and a safe deterministic offline fallback**, not full offline study/data functionality.
