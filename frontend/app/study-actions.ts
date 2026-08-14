"use server";

import { auth } from "@clerk/nextjs/server";
import {
  recordStudySessionReviewForUser,
  startOrResumeStudySessionForUser,
  type ReviewEvaluation,
  type StudySessionScope,
} from "@/lib/study-session-transactions";

export async function iniciarOuRetomarSessaoEstudo(scope: StudySessionScope = {}) {
  const { userId } = await auth();
  if (!userId) return { success: false as const, error: "Login necessário.", cards: [] };
  try {
    return await startOrResumeStudySessionForUser(userId, scope);
  } catch (error) {
    console.error("Erro ao iniciar/retomar sessão de estudo:", error);
    return { success: false as const, error: "Não foi possível carregar sua sessão de estudo.", cards: [] };
  }
}

export async function registrarRevisaoDaSessao(
  sessionId: string,
  cardId: string,
  avaliacao: ReviewEvaluation,
) {
  const { userId } = await auth();
  if (!userId) return { success: false as const, error: "Sua sessão expirou. Entre novamente para continuar." };
  if (!sessionId || !cardId) return { success: false as const, error: "Sessão de estudo inválida." };
  try {
    return await recordStudySessionReviewForUser(userId, sessionId, cardId, avaliacao);
  } catch (error) {
    console.error("Erro ao registrar revisão da sessão:", error);
    return { success: false as const, error: "Não foi possível salvar sua revisão. Tente novamente." };
  }
}
