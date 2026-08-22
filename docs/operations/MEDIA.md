# StudyFlash portfolio media

StudyFlash portfolio screenshots are generated from authenticated synthetic Playwright fixtures. They must never use real user data, production credentials, invented mockups, or ad-hoc manual state.

## Canonical capture source

The capture contract lives in `frontend/e2e/tests/product-ux.spec.ts`. It attaches full-page screenshots with animations disabled for representative product surfaces. This media-restoration change does not modify that capture code or any runtime/product behavior.

## Restored portfolio evidence

The public README uses byte-identical source PNGs from the already-reviewed Browser E2E artifact for exact source SHA `0fdda9a71a9c23ec77d63d4ce31c195ef9605c95`.

Source evidence:

- Browser E2E run: **#405** (`run_id=31855555526`), conclusion **success**;
- artifact: `browser-e2e-0fdda9a71a9c23ec77d63d4ce31c195ef9605c95`;
- artifact id: `9238945803`;
- artifact digest: `sha256:29b5fd7d2df5571d1a2a8aa2bd940f8c983f3c3f2fd712aa1b2774e3778ab81b`;
- source branch recorded by GitHub Actions: `work/26-portfolio-docs-brand`;
- source data: authenticated synthetic Playwright fixtures only.

The artifact was downloaded again for issue #88 and the proposed screenshots were inspected at full resolution before restoration. Each approved source PNG is copied byte-for-byte into the repository without re-encoding, palette reduction, resize, crop, content editing, blur, sharpening, annotation, or product-state alteration. This preserves the maximum fidelity available from the authoritative Browser E2E artifact.

| Durable repository file | Artifact path | Source attachment | Capture viewport | Full-page dimensions | PNG bytes / SHA-256 |
| --- | --- | --- | ---: | ---: | --- |
| `docs/media/create-flashcards-desktop-light.png` | `playwright-report/data/e7dd1e6961a2f2724e3c825644ed00f1af5f3ecd.png` | `dashboard-desktop-light` | 1440×1000 | 1440×1213 | 65,466 / `478f58c8ad5ab6647f109e2a542c3e560c6b0fa76ee44891a835b153f05d54c8` |
| `docs/media/profile-mobile-light.png` | `playwright-report/data/dbf7b92ee30bf8c17651eb486925aa2d5009227e.png` | `profile-mobile-light` | 390×844 | 390×1244 | 75,733 / `d1b39da568ef4a83d07c548b4d1978ef85d15979b4e8bea59c1ccf33c04c8409` |

The desktop attachment is named `dashboard-desktop-light` by the deterministic test, but the captured route is the actual StudyFlash create-material surface shown in the README. The durable filename describes the visible product state rather than inventing a different screen.

## Validation

Both restored durable files:

1. begin with the canonical PNG signature `89 50 4E 47 0D 0A 1A 0A`;
2. decode successfully as non-interlaced 8-bit truecolor PNG images;
3. preserve the original full-page pixel dimensions from the Browser E2E artifact;
4. were visually inspected at full resolution for clipping, overflow, text legibility, blur/compression artifacts, loading/error states, exposed secrets/credentials, and real-user identifiers;
5. contain only synthetic test state appropriate for portfolio documentation;
6. use repository-relative README image and click targets that resolve to the same durable files.

The desktop create surface is intentionally a stable empty-input state. The mobile profile shows synthetic level/XP/streak values and a synthetic placeholder initial; it is not represented as production-user data.

## Historical invalid media

The repository previously retained two files with `.webp` extensions:

- `docs/media/create-flashcards-desktop-light.webp` — Git blob `b57fc621c979c2933c6456ebe4bfc93a212cff5c`, 14,997 bytes;
- `docs/media/profile-mobile-light.webp` — Git blob `896b06763d0efc6e5d85aafd45f932d9785664e2`, 14,998 bytes.

Those blobs do not start with the required WebP `RIFF....WEBP` signature and are not decodable as supported image data. GitHub blob identity also shows the same invalid binaries were already present at historical documentation head `9d9bd50c337d3224400ddd0caaff9c7237262d28`, so that head cannot be used as a binary restoration source despite earlier review notes describing WebP inspection.

Issue #88 removes those undecodable binaries rather than retaining broken files in the public media directory. Their provenance remains recoverable from Git history and is recorded above; the public README points only to validated PNG assets.

## Presentation policy

The root English `README.md` is the canonical public visual landing page and embeds the two restored screenshots in a restrained product-preview section. Localized landing pages do not duplicate the image embeds; they retain the same technical claims and link back to this provenance policy when describing visual evidence.

Screenshots are evidence of the cited synthetic Browser E2E capture source only. They do not prove current live hosting, production configuration, live provider availability, or production-user state.

## Refresh procedure

1. Run Browser E2E on the exact candidate SHA intended as a new capture source.
2. Require the workflow to pass.
3. Download the Browser E2E artifact.
4. Inspect every proposed screenshot at full resolution.
5. Prefer the original source PNG for durable repository evidence. If lossless optimization becomes necessary, require a deterministic command, preserve content and dimensions, and validate format, magic bytes, decoder readability, hashes, and visual quality.
6. Copy only approved screenshots to durable repository media paths.
7. Record exact-SHA/run/artifact provenance, source/durable dimensions, hashes, and visual-review notes here.
8. Update README references only after durable files validate locally and resolve in GitHub.
9. Re-run exact-head checks after committing media/documentation changes; merge eligibility belongs to the new candidate SHA, not to the historical capture source.
