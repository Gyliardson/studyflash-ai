import "server-only";

import { AI_ACTION_TIMEOUT_MS } from "./ai-failure-policy";

const DEFAULT_AI_API_URL = "http://127.0.0.1:8000";
const INTERNAL_HEADER = "X-StudyFlash-Internal-Key";

export function getAiApiUrl(): string {
  return process.env.AI_API_URL || DEFAULT_AI_API_URL;
}

export function getAiApiKey(): string {
  const key = process.env.STUDYFLASH_INTERNAL_API_KEY?.trim();
  if (!key || key.length < 32) {
    throw new Error("STUDYFLASH_INTERNAL_API_KEY must be configured with at least 32 characters.");
  }
  return key;
}

export function getAiApiHeaders(extra: HeadersInit = {}): Headers {
  const headers = new Headers(extra);
  headers.set(INTERNAL_HEADER, getAiApiKey());
  return headers;
}

export function getAiAbortSignal(timeoutMs = AI_ACTION_TIMEOUT_MS): AbortSignal {
  return AbortSignal.timeout(timeoutMs);
}
