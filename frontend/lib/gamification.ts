export const XP_VALUES = {
  REVIEW_EASY: 15,
  REVIEW_HARD: 10,
  REVIEW_FAIL: 5,
  REVIEW_EXTRA: 0,
  CREATE_CARD: 5,
  DAILY_STREAK_BONUS: 50,
  COMPLETE_TOPIC: 20,
  EXAM_COMPLETION: 50,
  EXAM_PER_CORRECT_EASY: 5,
  EXAM_PER_CORRECT_MEDIUM: 10,
  EXAM_PER_CORRECT_HARD: 15,
  EXAM_PER_CORRECT_IMPOSSIBLE: 30,
  EXAM_PERFECT_BONUS: 100,
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