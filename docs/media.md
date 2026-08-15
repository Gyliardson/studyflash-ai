# StudyFlash portfolio media

StudyFlash portfolio screenshots are generated from authenticated synthetic Playwright fixtures. They must never use real user data, production credentials or ad-hoc manual state.

## Canonical capture source

The capture contract lives in `frontend/e2e/tests/product-ux.spec.ts`. It attaches full-page screenshots with animations disabled for these representative surfaces:

- `dashboard-desktop-light` — 1440×1000 viewport;
- `settings-desktop-dark` — 1440×1000 viewport;
- `collection-mobile-dark` — 390×844 viewport with the real mobile navigation open;
- `profile-mobile-light` — 390×844 viewport;
- `study-desktop-light` — 1440×1000 viewport;
- `exam-desktop-light` — 1440×1000 viewport.

Additional Browser E2E specs may attach screenshots for failure/recovery or creation flows, but final portfolio media should prefer stable representative surfaces unless a specific behavior needs evidence.

## Evidence provenance

A screenshot set is acceptable as release/portfolio evidence only when all of the following are recorded:

1. exact Git commit SHA;
2. Browser E2E run number/URL or artifact identity;
3. successful authenticated Browser E2E + accessibility execution for that same SHA;
4. synthetic test identity/data only;
5. visual inspection for clipping, overflow, unintended secrets/identifiers, loading/error artifacts and responsive regressions.

The curated #26 media was sourced from candidate SHA `0fdda9a71a9c23ec77d63d4ce31c195ef9605c95`, which passed Browser E2E #405 together with CI #561 and Study Session Integrity #276. Artifact `browser-e2e-0fdda9a71a9c23ec77d63d4ce31c195ef9605c95` was downloaded and its representative desktop/mobile, light/dark, study/exam/create/profile/navigation captures were visually inspected before curation.

## Curated repository media

The repository keeps a deliberately small portfolio set rather than duplicating the complete expiring Playwright artifact:

- `docs/media/create-flashcards-desktop-light.webp` — desktop/light creation surface, downscaled from the reviewed exact-SHA artifact without cropping or content alteration;
- `docs/media/profile-mobile-light.webp` — mobile/light profile surface from the same reviewed artifact.

The WebP copies are presentation derivatives of the reviewed screenshots. Compression/downscaling must keep text readable and must never crop or restyle the UI to hide defects. Full-resolution evidence remains available in the corresponding Browser E2E artifact while retained by GitHub Actions.

## Refresh procedure

1. Run Browser E2E on the exact candidate SHA.
2. Require the workflow to pass.
3. Download the Browser E2E artifact.
4. Inspect every proposed screenshot at full resolution.
5. Copy only approved screenshots to the durable media paths.
6. Update this provenance record and README references if filenames change.
7. Re-run CI/Browser E2E if committing media or documentation changes moves the PR head; merge eligibility always belongs to the new exact head.
