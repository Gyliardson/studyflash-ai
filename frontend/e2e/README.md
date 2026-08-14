# StudyFlash browser tests

Deterministic Playwright checks for the StudyFlash frontend.

The suite uses desktop and mobile Chromium with stable `pt-BR` locale and `America/Sao_Paulo` timezone. Public tests retain traces only on failure. Authenticated tests deliberately keep tracing disabled so reusable Clerk session material is not published as evidence.

## Clerk development test environment

Authenticated E2E uses a dedicated Clerk **development instance** only. Provide its development credentials as environment variables:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` for the Next.js runtime;
- `CLERK_PUBLISHABLE_KEY` for `@clerk/testing`;
- `CLERK_SECRET_KEY` server-side for Clerk Testing Tokens and test sign-in.

In GitHub Actions these variables are mapped from repository secrets. Never commit or print their values, and never substitute production credentials.

The E2E setup calls `clerkSetup()` and uses only a synthetic `+clerk_test` identity. Tests use Clerk's official `clerk.signIn()` helper. No application auth bypass or fake session exists.

No Playwright storage state is written. `.auth/` and `storage-state*.json` are gitignored defensively, and authenticated projects have traces disabled.

The gate-critical authenticated flow signs in, reaches the protected dashboard, submits an empty generation request, verifies the deterministic validation message, confirms no AI request is made, and runs Axe against that authenticated state.

The suite must not depend on production Neon, production Clerk, or a remote LLM.

Official Clerk reference: https://clerk.com/docs/guides/development/testing/playwright/overview
