import type { BlockSlotsConfig } from "@/types/block-slots";

type ParseResult = {
  config: BlockSlotsConfig;
  maxRound: number;
  blockCount: number;
};

/**
 * block_slots CSV テキストをパースして BlockSlotsConfig を返す。
 * 新フォーマット(10列) / レガシー(4列) を自動判定する。
 * BOM除去は呼び出し元で実施すること。
 */
export function parseBlockSlotsCsv(text: string): ParseResult {
  const config: BlockSlotsConfig = {};
  let maxRound = 0;

  for (const line of text.split("\n")) {
    const parts = line.trim().split(",");
    const blockName = parts[0];
    if (!blockName || parts.length < 4) continue;
    if (isNaN(parseInt(parts[1], 10))) continue;

    if (parts.length >= 10) {
      // New format: block,fTotal,f1,f2,uTotal,u1,u2,tTotal,t1,t2
      const freshman = [Number(parts[2]), Number(parts[3])];
      const upperclassman = [Number(parts[5]), Number(parts[6])];
      const temporary = [Number(parts[8]), Number(parts[9])];
      config[blockName] = { freshman, upperclassman, temporary };
      maxRound = Math.max(maxRound, freshman.length, upperclassman.length, temporary.length);
    } else {
      // Legacy format: block,total,r1,r2
      const slots = parts.slice(2).map(Number);
      config[blockName] = {
        freshman: slots,
        upperclassman: slots.map(() => 0),
        temporary: slots.map(() => 0),
      };
      maxRound = Math.max(maxRound, slots.length);
    }
  }

  return { config, maxRound, blockCount: Object.keys(config).length };
}
