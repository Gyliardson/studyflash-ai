import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100";
const readinessURL = new URL("/manifest.webmanifest", baseURL).toString();
const publicTests = /(?:smoke|accessibility)\.spec\.ts/;
const authenticatedTests = /(?:authenticated|idempotent-create|exam-race)\.spec\.ts/;
const productUxTests = /product-ux\.spec\.ts/;
const criticalA11yTests = /critical-a11y\.spec\.ts/;
const studyReviewTests = /study-review\.spec\.ts/;
const pwaTests = /pwa\.spec\.ts/;

export default defineConfig({
  testDir: "./tests",
  // Release evidence must be fail-closed: a first-attempt failure is a gate failure.
  // Keep retries disabled in every environment so Browser E2E and Clean Room cannot
  // turn a deterministic regression or flake into a green required check.
  retries: 0,
  workers: process.env.CI ? 1 : undefined,
  outputDir: "test-results",
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    screenshot: "only-on-failure",
    trace: "off",
  },
  projects: [
    {
      name: "setup",
      testMatch: /global\.setup\.ts/,
    },
    {
      name: "public-desktop",
      testMatch: publicTests,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        trace: "retain-on-failure",
      },
    },
    {
      name: "public-mobile",
      testMatch: publicTests,
      dependencies: ["setup"],
      use: { ...devices["Pixel 7"], trace: "retain-on-failure" },
    },
    {
      name: "authenticated-desktop",
      testMatch: authenticatedTests,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        trace: "off",
      },
    },
    {
      name: "product-ux-desktop",
      testMatch: productUxTests,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        trace: "retain-on-failure",
      },
    },
    {
      name: "critical-a11y-desktop",
      testMatch: criticalA11yTests,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        trace: "off",
      },
    },
    {
      name: "critical-a11y-mobile",
      testMatch: criticalA11yTests,
      dependencies: ["setup"],
      use: {
        ...devices["Pixel 7"],
        trace: "off",
      },
    },
    {
      name: "study-review-desktop",
      testMatch: studyReviewTests,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        trace: "off",
      },
    },
    {
      name: "study-review-mobile",
      testMatch: studyReviewTests,
      dependencies: ["setup"],
      use: {
        ...devices["Pixel 7"],
        trace: "off",
      },
    },
    {
      name: "pwa-desktop",
      testMatch: pwaTests,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        trace: "retain-on-failure",
      },
    },
    {
      name: "pwa-mobile",
      testMatch: pwaTests,
      dependencies: ["setup"],
      use: { ...devices["Pixel 7"], trace: "retain-on-failure" },
    },
  ],
  webServer: {
    command: "npm --prefix .. run start -- -p 3100",
    url: readinessURL,
    reuseExistingServer: !process.env.CI,
  },
});