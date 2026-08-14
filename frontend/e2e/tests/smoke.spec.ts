import { expect, test } from "@playwright/test";

test("StudyFlash landing page boots with truthful primary entry points", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.ok()).toBeTruthy();
  await expect(page).toHaveTitle(/StudyFlash/i);
  await expect(page.getByRole("heading", { name: /Do material bruto à revisão/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Criar material de estudo/i })).toHaveAttribute("href", "/dashboard");
  await expect(page.getByRole("heading", { name: /Um caminho claro entre criar, organizar e praticar/i })).toBeVisible();
  await expect(page.getByText(/Ana Paula Costa|Lucas Rodrigues/)).toHaveCount(0);
});

test("unauthenticated dashboard navigation stays protected", async ({ page }) => {
  const response = await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  expect(response?.status()).not.toBe(500);
  await expect(page).not.toHaveURL(/\/dashboard(?:[/?#]|$)/);
});
