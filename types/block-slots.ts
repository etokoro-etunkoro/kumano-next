/**
 * Block Slots Type Definitions
 *
 * Defines the capacity structure for each block, organized by rookie category.
 * Each category has an array of slot counts per round.
 *
 * Example:
 * {
 *   "A1": {
 *     "freshman": [2, 1],      // 一回生: 第1巡2枠, 第2巡1枠
 *     "upperclassman": [1, 0], // 上回生: 第1巡1枠, 第2巡0枠
 *     "temporary": [0, 0]      // 臨時キャパ: 枠なし
 *   }
 * }
 */

import type { RookieCategory } from "./rookie";

/**
 * Slots per round for a single category
 * Array index = round number (0 = round 1, 1 = round 2, ...)
 */
export type CategorySlots = number[];

/**
 * Block's capacity organized by category
 */
export type BlockCategorySlots = {
  [K in RookieCategory]: CategorySlots;
};

/**
 * Complete block slots configuration
 * Maps block name to its category-based slot configuration
 */
export type BlockSlotsConfig = Record<string, BlockCategorySlots>;

/**
 * Legacy block slots format for backward compatibility
 * @deprecated Use BlockSlotsConfig instead
 */
export type LegacyBlockSlots = Record<string, number[]>;

/**
 * Type guard to check if block slots are in new category-based format
 */
export function isNewBlockSlotsFormat(
  slots: BlockSlotsConfig | LegacyBlockSlots
): slots is BlockSlotsConfig {
  const firstValue = Object.values(slots)[0];
  if (!firstValue) return false;
  return (
    typeof firstValue === "object" &&
    !Array.isArray(firstValue) &&
    "freshman" in firstValue
  );
}

/**
 * Convert legacy format to new category-based format
 * Legacy slots are assigned to freshman category, others get empty arrays
 */
export function convertLegacyToNewFormat(
  legacy: LegacyBlockSlots
): BlockSlotsConfig {
  const result: BlockSlotsConfig = {};
  for (const [blockName, slots] of Object.entries(legacy)) {
    result[blockName] = {
      freshman: slots,
      upperclassman: slots.map(() => 0),
      temporary: slots.map(() => 0),
    };
  }
  return result;
}

/**
 * Get slots for a specific block and category
 */
export function getBlockCategorySlots(
  config: BlockSlotsConfig,
  blockName: string,
  category: RookieCategory
): CategorySlots {
  return config[blockName]?.[category] ?? [];
}

/**
 * Get total slots for a block across all categories for a specific round
 */
export function getTotalSlotsForRound(
  config: BlockSlotsConfig,
  blockName: string,
  roundIndex: number
): number {
  const block = config[blockName];
  if (!block) return 0;
  return (
    (block.freshman[roundIndex] ?? 0) +
    (block.upperclassman[roundIndex] ?? 0) +
    (block.temporary[roundIndex] ?? 0)
  );
}
