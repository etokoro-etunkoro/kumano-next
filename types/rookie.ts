/**
 * Rookie (New Resident) Type Definitions
 *
 * category: "freshman" | "upperclassman" | "temporary"
 *   - freshman: 一回生（新入生）
 *   - upperclassman: 上回生（2回生以上）
 *   - temporary: 臨時キャパシティ
 *
 * remaining: boolean
 *   - true: 残っている（未選択）
 *   - false: 選択済み
 */

export type RookieCategory = "freshman" | "upperclassman" | "temporary";

export interface Rookie {
  id: number;
  name?: string;
  category: RookieCategory;
  remaining: boolean;
}

/**
 * Legacy Rookie type for backward compatibility
 * @deprecated Use Rookie instead
 */
export interface LegacyRookie {
  id?: number;
  number?: number;
  name?: string;
}

/**
 * Type guard to check if a rookie has the new category/remaining fields
 */
export function isNewRookie(rookie: Rookie | LegacyRookie): rookie is Rookie {
  return 'category' in rookie && 'remaining' in rookie;
}
