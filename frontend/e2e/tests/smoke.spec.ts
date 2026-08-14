import { expect, test } from "@playwright/test";

test("StudyFlash landing page boots", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.ok()).toBeTruthy();
  await expect(page).toHaveTitle(/StudyFlash/i);
  await expect(page.getByRole("heading", { name: /Estude Mais Rápido com Flashcards de IA/i })).toBeVisible();
});

test("unauthenticated dashboard navigation stays protected", async ({ page }) => {
  const response = await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  expect(response?.status()).not.toBe(500);
  await expect(page).not.toHaveURL(/\/dashboard(?:[/?#]|$)/);
});
