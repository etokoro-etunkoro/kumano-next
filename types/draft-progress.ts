/**
 * Draft Progress Type Definitions
 *
 * Manages the overall draft session state including:
 * - Current category (freshman/upperclassman/temporary)
 * - Current round within the category
 * - Current phase (picking/janken/confirmed)
 */

import type { RookieCategory } from "./rookie";

/**
 * Draft phase enum
 * - picking: 入力中（各ブロックが番号を入力している）
 * - janken: ジャンケン中（重複指名の解決中）
 * - confirmed: 確定（当該ラウンド終了）
 */
export type DraftPhase = "picking" | "janken" | "confirmed";

/**
 * Draft progress state
 */
export interface DraftProgress {
  category: RookieCategory;
  round: number;
  maxRound: number;
  phase: DraftPhase;
}

/**
 * Category order for draft progression
 */
export const CATEGORY_ORDER: readonly RookieCategory[] = [
  "freshman",
  "upperclassman",
  "temporary",
] as const;

/**
 * Category display names (Japanese)
 */
export const CATEGORY_LABELS: Record<RookieCategory, string> = {
  freshman: "一回生",
  upperclassman: "上回生",
  temporary: "臨時キャパ",
};

/**
 * Phase display names (Japanese)
 */
export const PHASE_LABELS: Record<DraftPhase, string> = {
  picking: "入力中",
  janken: "ジャンケン中",
  confirmed: "確定",
};

/**
 * Get the next phase in the progression
 */
export function getNextPhase(current: DraftPhase, hasConflicts: boolean): DraftPhase {
  switch (current) {
    case "picking":
      return hasConflicts ? "janken" : "confirmed";
    case "janken":
      return "confirmed";
    case "confirmed":
      return "picking"; // Next round starts
    default:
      return "picking";
  }
}

/**
 * Get the next category in the progression
 * Returns null if all categories are complete
 */
export function getNextCategory(current: RookieCategory): RookieCategory | null {
  const currentIndex = CATEGORY_ORDER.indexOf(current);
  if (currentIndex === -1 || currentIndex >= CATEGORY_ORDER.length - 1) {
    return null;
  }
  return CATEGORY_ORDER[currentIndex + 1];
}

/**
 * Check if the draft is complete (all categories and rounds finished)
 */
export function isDraftComplete(progress: DraftProgress): boolean {
  return (
    progress.category === "temporary" &&
    progress.round >= progress.maxRound &&
    progress.phase === "confirmed"
  );
}

/**
 * Create initial draft progress state
 */
export function createInitialProgress(maxRound: number = 2): DraftProgress {
  return {
    category: "freshman",
    round: 1,
    maxRound,
    phase: "picking",
  };
}
