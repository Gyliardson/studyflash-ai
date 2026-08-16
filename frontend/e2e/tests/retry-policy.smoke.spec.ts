import { test } from "@playwright/test";

test("release retry policy canary rejects a first-attempt failure", async ({}, testInfo) => {
  test.skip(
    process.env.RETRY_POLICY_CANARY !== "1",
    "Canary is activated only by the release-policy verification command.",
  );

  if (testInfo.retry === 0) {
    throw new Error("RETRY_POLICY_CANARY_FIRST_ATTEMPT: expected fail-closed first attempt");
  }
});
