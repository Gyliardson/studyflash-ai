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

Additional Browser E2E specs may attach screenshots for failure/recovery or creation flows, but final portfolio media should prefer the stable representative surfaces above unless a specific behavior needs evidence.

## Evidence provenance

A screenshot set is acceptable as release/portfolio evidence only when all of the following are recorded:

1. exact Git commit SHA;
2. Browser E2E run number/URL or artifact identity;
3. successful authenticated Browser E2E + accessibility execution for that same SHA;
4. synthetic test identity/data only;
5. visual inspection for clipping, overflow, unintended secrets/identifiers, loading/error artifacts and responsive regressions.

For the #26 documentation candidate, predecessor SHA `8a8a629190727a3f2d29d42036b3637958284368` passed Browser E2E #391 and produced artifact `browser-e2e-8a8a629190727a3f2d29d42036b3637958284368`. That artifact was visually inspected during #26 and included the required desktop/mobile light/dark surfaces. It is evidence for the inspected SHA only; it must not be reused as merge eligibility for a later head.

## Curated repository media

GitHub Actions artifacts expire, so final README/portfolio screenshots must be copied from a green exact-SHA artifact into a durable repository media location (for example `docs/media/`) only after visual review. Preserve descriptive filenames and record the source SHA in the commit/PR.

Do not optimize, crop or restyle a screenshot in a way that hides product defects. If compression is applied, keep text readable and do not alter UI content.

## Refresh procedure

1. Run Browser E2E on the exact candidate SHA.
2. Require the workflow to pass.
3. Download the Browser E2E artifact.
4. Inspect every proposed screenshot at full resolution.
5. Copy only approved screenshots to the durable media paths.
6. Update README references if the selected filenames change.
7. Re-run CI/Browser E2E if committing media or documentation changes moves the PR head; merge eligibility always belongs to the new exact head.
