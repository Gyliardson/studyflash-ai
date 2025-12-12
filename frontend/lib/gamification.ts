export const XP_VALUES = {
  REVIEW_EASY: 15,
  REVIEW_HARD: 10,
  REVIEW_FAIL: 5,
  REVIEW_EXTRA: 0,
  CREATE_CARD: 5,
  DAILY_STREAK_BONUS: 50,
  
  // === NOVO ===
  COMPLETE_TOPIC: 20, // Recompensa por fechar um módulo da trilha
};

export const DAILY_LIMITS = {
  MAX_XP_FROM_CREATION: 50,
};

export type NivelInfo = {
  level: number;
  xpRequiredForNext: number;
  progress: number;
  isMaxLevel: boolean;
  xpToNext: number;
};

export function calcularNivel(totalXp: number): NivelInfo {
  const BASE_XP = 100;
  
  const level = Math.floor(1 + Math.sqrt(totalXp / BASE_XP));
  
  const currentLevelBaseXp = BASE_XP * Math.pow(level - 1, 2);
  const nextLevelBaseXp = BASE_XP * Math.pow(level, 2);
  
  const xpIntoLevel = totalXp - currentLevelBaseXp;
  const xpRequiredForNext = nextLevelBaseXp - currentLevelBaseXp;
  
  const progress = xpRequiredForNext > 0 
    ? Math.min(100, Math.round((xpIntoLevel / xpRequiredForNext) * 100))
    : 0;

  return {
    level,
    xpRequiredForNext,
    progress,
    isMaxLevel: false,
    xpToNext: Math.max(0, nextLevelBaseXp - totalXp)
  };
}