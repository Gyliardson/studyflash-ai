export const AI_PROVIDER_TIMEOUT_SECONDS = 8;
export const AI_ACTION_TIMEOUT_MS = 12_000;
export const AI_PDF_PROXY_TIMEOUT_MS = 15_000;
export const AI_EXAM_FALLBACK_TIMEOUT_MS = 8_000;

export type AiFailureKind = "invalid-input" | "rate-limit" | "timeout" | "unavailable" | "invalid-output" | "unexpected";

export function classifyAiHttpStatus(status: number): AiFailureKind {
  if (status === 422) return "invalid-input";
  if (status === 429) return "rate-limit";
  if (status === 504) return "timeout";
  if (status === 503) return "unavailable";
  if (status === 502) return "invalid-output";
  return "unexpected";
}

export function safeAiUserMessage(status: number): string {
  switch (classifyAiHttpStatus(status)) {
    case "invalid-input":
      return "Revise os dados enviados e tente novamente.";
    case "rate-limit":
      return "A IA está temporariamente no limite de capacidade. Tente novamente em instantes.";
    case "timeout":
      return "A IA demorou mais que o limite de resposta. Tente novamente.";
    case "unavailable":
    case "invalid-output":
      return "A IA está temporariamente indisponível. Tente novamente.";
    default:
      return "Falha ao comunicar com a IA.";
  }
}

export function isAbortTimeout(error: unknown): boolean {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}

export function shouldUseLocalExamFallback(status: number | null): boolean {
  if (status === null) return true;
  return status === 429 || status === 502 || status === 503 || status === 504 || status >= 500;
}
