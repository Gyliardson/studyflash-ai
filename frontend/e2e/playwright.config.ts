import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100";
const readinessURL = new URL("/manifest.webmanifest", baseURL).toString();
const publicTests = /(?:smoke|accessibility)\.spec\.ts/;

export default defineConfig({
  testDir: "./tests",
  globalSetup: "./global.setup.ts",
  retries: process.env.CI ? 1 : 0,
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
      name: "public-desktop",
      testMatch: publicTests,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        trace: "retain-on-failure",
      },
    },
    {
      name: "public-mobile",
      testMatch: publicTests,
      use: { ...devices["Pixel 7"], trace: "retain-on-failure" },
    },
    {
      name: "authenticated-desktop",
      testMatch: /authenticated\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        trace: "off",
      },
    },
  ],
  webServer: {
    command: "npm --prefix .. run start -- -p 3100",
    url: readinessURL,
    reuseExistingServer: !process.env.CI,
  },
});
