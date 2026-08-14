import { randomBytes } from "node:crypto";
import { clerkSetup } from "@clerk/testing/playwright";

const TEST_USER_EMAIL =
  process.env.E2E_CLERK_TEST_EMAIL ?? "studyflash.e2e+clerk_test@example.com";

function requireClerkEnvironment() {
  if (!process.env.CLERK_PUBLISHABLE_KEY) {
    throw new Error("CLERK_PUBLISHABLE_KEY is required for StudyFlash E2E");
  }
  if (!process.env.CLERK_SECRET_KEY) {
    throw new Error("CLERK_SECRET_KEY is required for StudyFlash E2E");
  }
}

async function clerkBackendRequest(path: string, init: RequestInit = {}) {
  const response = await fetch(`https://api.clerk.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Clerk development API request failed with HTTP ${response.status}`);
  }

  return response;
}

async function ensureSyntheticTestUser() {
  const query = new URLSearchParams({ query: TEST_USER_EMAIL, limit: "10" });
  const response = await clerkBackendRequest(`/users?${query.toString()}`);
  const users = (await response.json()) as Array<{
    email_addresses?: Array<{ email_address?: string }>;
  }>;

  const existing = users.some((user) =>
    user.email_addresses?.some(
      (entry) => entry.email_address?.toLowerCase() === TEST_USER_EMAIL.toLowerCase(),
    ),
  );

  if (existing) return;

  const password = `SfE2E-${randomBytes(24).toString("base64url")}!Aa9`;
  await clerkBackendRequest("/users", {
    method: "POST",
    body: JSON.stringify({
      email_address: [TEST_USER_EMAIL],
      password,
      first_name: "StudyFlash",
      last_name: "E2E",
    }),
  });
}

export default async function globalSetup() {
  requireClerkEnvironment();
  await ensureSyntheticTestUser();
  await clerkSetup({ dotenv: false });
}
