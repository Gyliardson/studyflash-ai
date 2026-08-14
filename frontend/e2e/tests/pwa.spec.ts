import { randomUUID } from "node:crypto";
import { clerk } from "@clerk/testing/playwright";
import { expect, test, type Page } from "@playwright/test";

const TEST_USER_EMAIL = process.env.E2E_CLERK_TEST_EMAIL ?? "studyflash.e2e+clerk_test@example.com";

async function waitForStableServiceWorkerControl(page: Page) {
  await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) throw new Error("Service workers are unavailable in this browser context");
    await navigator.serviceWorker.ready;
  });
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.state ?? null)).toBe("activated");
}

async function ensureServiceWorkerControl(page: Page) {
  await page.goto("/");
  await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) throw new Error("Service workers are unavailable in this browser context");
    await navigator.serviceWorker.ready;
  });
  if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) {
    await page.reload({ waitUntil: "domcontentloaded" });
  }
  await waitForStableServiceWorkerControl(page);
}

async function cachedSameOriginURLs(page: Page) {
  return page.evaluate(async () => {
    const urls: string[] = [];
    for (const cacheName of await caches.keys()) {
      const cache = await caches.open(cacheName);
      for (const request of await cache.keys()) {
        const url = new URL(request.url);
        if (url.origin === location.origin) urls.push(`${url.pathname}${url.search}`);
      }
    }
    return urls;
  });
}

test("production worker controls the app, Chromium accepts installability, and uncached navigation has a deterministic offline fallback", async ({ page, context }) => {
  const offlineDocumentResponse = await page.request.get("/offline-fallback.html");
  expect(offlineDocumentResponse.ok(), "The dependency-free offline document must stay publicly fetchable so Workbox can precache it").toBe(true);
  expect(await offlineDocumentResponse.text()).toContain("Você está sem conexão");

  await ensureServiceWorkerControl(page);

  const manifestResponse = await page.request.get("/manifest.webmanifest");
  expect(manifestResponse.ok()).toBe(true);
  const manifest = await manifestResponse.json();
  expect(manifest.name).toBe("StudyFlash");
  expect(manifest.short_name).toBe("StudyFlash");
  expect(manifest.start_url).toBe("/");
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons).toEqual(expect.arrayContaining([
    expect.objectContaining({ src: "/icon-192.png", sizes: "192x192", type: "image/png" }),
    expect.objectContaining({ src: "/icon-512.png", sizes: "512x512", type: "image/png" }),
  ]));
  expect((await page.request.get("/icon-192.png")).ok()).toBe(true);
  expect((await page.request.get("/icon-512.png")).ok()).toBe(true);

  const cdp = await context.newCDPSession(page);
  await cdp.send("Page.enable");
  const appManifest = await cdp.send("Page.getAppManifest");
  expect(appManifest.errors).toEqual([]);
  const installability = await cdp.send("Page.getInstallabilityErrors");
  expect(installability.installabilityErrors).toEqual([]);

  await page.evaluate(async () => {
    await caches.open("studyflash-next-static-v0");
    await caches.open("studyflash-retired-auth-cache-v0");
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect.poll(() => page.evaluate(async () => (await caches.keys()).filter((name) => name.startsWith("studyflash-") && name.endsWith("-v0")))).toEqual([]);
  await waitForStableServiceWorkerControl(page);

  await context.setOffline(true);
  try {
    await page.goto(`/privacidade?offline-probe=${randomUUID()}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Você está sem conexão" })).toBeVisible();
    await expect(page.getByText(/não mantém conteúdos da sua conta em cache offline/i)).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});

test("authenticated HTML and data are not retained in runtime caches and offline revisit never exposes a stale dashboard", async ({ page, context }) => {
  await ensureServiceWorkerControl(page);
  await clerk.signIn({ page, emailAddress: TEST_USER_EMAIL });
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard(?:[/?#]|$)/);
  await expect(page.getByRole("button", { name: /Gerar Flashcards/i })).toBeVisible();

  const cachedURLs = await cachedSameOriginURLs(page);
  const sensitiveRuntimeEntries = cachedURLs.filter((value) =>
    value.startsWith("/dashboard") ||
    value.startsWith("/api/") ||
    value.includes("_rsc=") ||
    value.includes("__clerk")
  );
  expect(sensitiveRuntimeEntries, `Sensitive cache entries: ${sensitiveRuntimeEntries.join(", ")}`).toEqual([]);

  await context.setOffline(true);
  try {
    await page.goto(`/dashboard?offline-probe=${randomUUID()}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Você está sem conexão" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Gerar Flashcards/i })).toHaveCount(0);
  } finally {
    await context.setOffline(false);
  }
});