import test from "node:test";
import assert from "node:assert/strict";

import {
  AI_ACTION_TIMEOUT_MS,
  AI_EXAM_FALLBACK_TIMEOUT_MS,
  AI_PDF_PROXY_TIMEOUT_MS,
  AI_PROVIDER_TIMEOUT_SECONDS,
  classifyAiHttpStatus,
  safeAiUserMessage,
  shouldUseLocalExamFallback,
} from "../lib/ai-failure-policy.ts";

test("AI timeout budgets are nested so inner provider failures resolve before outer callers", () => {
  const providerMs = AI_PROVIDER_TIMEOUT_SECONDS * 1000;
  assert.ok(providerMs > 0);
  assert.ok(providerMs < AI_EXAM_FALLBACK_TIMEOUT_MS);
  assert.ok(AI_EXAM_FALLBACK_TIMEOUT_MS < AI_ACTION_TIMEOUT_MS);
  assert.ok(AI_ACTION_TIMEOUT_MS < AI_PDF_PROXY_TIMEOUT_MS);
});

test("FastAPI status semantics map to stable frontend failure kinds", () => {
  assert.equal(classifyAiHttpStatus(422), "invalid-input");
  assert.equal(classifyAiHttpStatus(429), "rate-limit");
  assert.equal(classifyAiHttpStatus(502), "invalid-output");
  assert.equal(classifyAiHttpStatus(503), "unavailable");
  assert.equal(classifyAiHttpStatus(504), "timeout");
  assert.equal(classifyAiHttpStatus(500), "unexpected");
});

test("user messages are static and do not echo upstream response text", () => {
  const privateProviderText = "provider secret raw response";
  for (const status of [422, 429, 502, 503, 504, 500]) {
    const message = safeAiUserMessage(status);
    assert.ok(message.length > 0);
    assert.equal(message.includes(privateProviderText), false);
  }
});

test("exam fallback is restricted to transient/provider failures", () => {
  for (const status of [null, 429, 500, 502, 503, 504]) {
    assert.equal(shouldUseLocalExamFallback(status), true, `expected fallback for ${status}`);
  }
  for (const status of [400, 401, 403, 404, 422]) {
    assert.equal(shouldUseLocalExamFallback(status), false, `unexpected fallback for ${status}`);
  }
});
