# StudyFlash browser tests

Deterministic Playwright checks for the StudyFlash frontend.

From `frontend/` run:

```bash
npm ci
npm --prefix e2e ci
npm --prefix e2e run install:chromium
npm run build
npm run test:e2e
```

The runner starts the production build on port 3100. It exercises desktop and mobile Chromium with a stable locale and timezone, retains traces on failure, and captures failure screenshots.

Current coverage starts with public application boot and automated accessibility scanning. Additional product flows should extend this package as their deterministic test prerequisites become available.

## Clerk test environment

StudyFlash uses Clerk in the server runtime, including `clerkMiddleware()` and server-side `auth()` calls. A production build can compile with a placeholder publishable key, but a truthful browser run of the application requires a real **Clerk development instance** with development-only API keys.

Do not use production Clerk credentials, fake sessions, or an application auth bypass to make E2E green. The dedicated test setup tracked in issue #16 should provide revocable development credentials through local environment variables / GitHub Actions secrets and use only synthetic test identities.

Until that prerequisite is provisioned, browser failures caused by missing Clerk server credentials are an explicit environment blocker rather than evidence that the protected application boundary works. Public smoke/a11y infrastructure can continue to be developed, but authenticated E2E coverage must not be claimed.

Reference: https://clerk.com/docs/guides/development/testing/playwright/overview
