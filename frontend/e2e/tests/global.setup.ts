import { randomBytes } from "node:crypto";
import { test as setup } from "@playwright/test";
import { clerkSetup } from "@clerk/testing/playwright";
import prisma from "../../lib/db.ts";

const TEST_USER_EMAIL =
  process.env.E2E_CLERK_TEST_EMAIL ?? "studyflash.e2e+clerk_test@example.com";
const E2E_DECK_NAME = "StudyFlash E2E Exam Fixture";

function requireClerkEnvironment() {
  if (!process.env.CLERK_PUBLISHABLE_KEY) {
    throw new Error("CLERK_PUBLISHABLE_KEY is required for StudyFlash E2E");
  }
  if (!process.env.CLERK_SECRET_KEY) {
    throw new Error("CLERK_SECRET_KEY is required for StudyFlash E2E");
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for StudyFlash E2E fixtures");
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

type ClerkTestUser = {
  id: string;
  email_addresses?: Array<{ email_address?: string }>;
};

async function ensureSyntheticTestUser(): Promise<string> {
  const query = new URLSearchParams({ query: TEST_USER_EMAIL, limit: "10" });
  const response = await clerkBackendRequest(`/users?${query.toString()}`);
  const users = (await response.json()) as ClerkTestUser[];

  const existing = users.find((user) =>
    user.email_addresses?.some(
      (entry) => entry.email_address?.toLowerCase() === TEST_USER_EMAIL.toLowerCase(),
    ),
  );

  if (existing) return existing.id;

  const password = `SfE2E-${randomBytes(24).toString("base64url")}!Aa9`;
  const created = await clerkBackendRequest("/users", {
    method: "POST",
    body: JSON.stringify({
      email_address: [TEST_USER_EMAIL],
      password,
      first_name: "StudyFlash",
      last_name: "E2E",
    }),
  });
  const user = (await created.json()) as ClerkTestUser;
  return user.id;
}

async function seedExamFixture(userId: string) {
  await prisma.examQuestion.deleteMany({ where: { session: { userId } } });
  await prisma.examSession.deleteMany({ where: { userId } });
  await prisma.examAttemptQuestion.deleteMany({ where: { attempt: { userId } } });
  await prisma.examAttempt.deleteMany({ where: { userId } });
  await prisma.xPHistory.deleteMany({ where: { userId, source: "EXAM" } });
  await prisma.deck.deleteMany({ where: { userId, nome: E2E_DECK_NAME } });

  await prisma.deck.create({
    data: {
      userId,
      nome: E2E_DECK_NAME,
      cards: {
        create: [
          { userId, frente: "Capital do Brasil?", verso: "Brasília" },
          { userId, frente: "2 + 2?", verso: "4" },
          { userId, frente: "Planeta vermelho?", verso: "Marte" },
          { userId, frente: "Linguagem do navegador?", verso: "JavaScript" },
          { userId, frente: "Oposto de norte?", verso: "Sul" },
        ],
      },
    },
  });
}

setup.describe.configure({ mode: "serial" });

setup("configure Clerk testing and deterministic StudyFlash fixture", async () => {
  requireClerkEnvironment();
  const userId = await ensureSyntheticTestUser();
  await seedExamFixture(userId);
  await clerkSetup({ dotenv: false });
});
