import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getAiApiHeaders, getAiApiUrl } from "@/lib/ai-api";

export const runtime = "nodejs";

const MAX_PROXY_BODY_BYTES = 11 * 1024 * 1024;

class RequestBodyTooLargeError extends Error {}

async function readRequestBodyLimited(request: Request): Promise<ArrayBuffer> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength) {
    const parsedLength = Number(declaredLength);
    if (!Number.isFinite(parsedLength) || parsedLength < 0 || parsedLength > MAX_PROXY_BODY_BYTES) {
      throw new RequestBodyTooLargeError();
    }
  }

  if (!request.body) {
    return new ArrayBuffer(0);
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      total += value.byteLength;
      if (total > MAX_PROXY_BODY_BYTES) {
        await reader.cancel();
        throw new RequestBodyTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const buffer = new ArrayBuffer(total);
  const payload = new Uint8Array(buffer);
  let offset = 0;
  for (const chunk of chunks) {
    payload.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return buffer;
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ detail: "Não autorizado." }, { status: 401 });
  }

  try {
    const contentType = request.headers.get("content-type");
    if (!contentType?.toLowerCase().startsWith("multipart/form-data")) {
      return NextResponse.json({ detail: "Formato de requisição inválido." }, { status: 415 });
    }

    const requestBody = await readRequestBodyLimited(request);
    const response = await fetch(`${getAiApiUrl()}/api/gerar`, {
      method: "POST",
      headers: getAiApiHeaders({ "Content-Type": contentType }),
      body: requestBody,
      cache: "no-store",
      signal: AbortSignal.timeout(90_000),
    });

    const responseContentType = response.headers.get("content-type") || "application/json";
    const payload = await response.arrayBuffer();

    return new Response(payload, {
      status: response.status,
      headers: { "content-type": responseContentType },
    });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ detail: "Requisição excede o tamanho máximo permitido." }, { status: 413 });
    }

    const isTimeout = error instanceof Error && error.name === "TimeoutError";
    return NextResponse.json(
      { detail: isTimeout ? "O servidor demorou muito para responder." : "Falha ao processar solicitação." },
      { status: isTimeout ? 504 : 502 },
    );
  }
}
