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
