import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getAiApiHeaders, getAiApiUrl } from "@/lib/ai-api";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ detail: "Não autorizado." }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const response = await fetch(`${getAiApiUrl()}/api/gerar`, {
      method: "POST",
      headers: getAiApiHeaders(),
      body: formData,
      cache: "no-store",
      signal: AbortSignal.timeout(90_000),
    });

    const contentType = response.headers.get("content-type") || "application/json";
    const payload = await response.arrayBuffer();

    return new Response(payload, {
      status: response.status,
      headers: { "content-type": contentType },
    });
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === "TimeoutError";
    return NextResponse.json(
      { detail: isTimeout ? "O servidor demorou muito para responder." : "Falha ao processar solicitação." },
      { status: isTimeout ? 504 : 502 },
    );
  }
}
