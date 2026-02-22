// utils/draftTableUtils.ts

export type Cell = {
  cycle: "1st" | "2nd";
  index: number;
  value: string;
  status: "editable" | "span" | "confirmed";
};

export type Row = {
  block: string;
  cells: Cell[];
};

// ── Feature F: 敗者再入力枠制御 ──

/**
 * 指定ブロックの指定ラウンドにおける枠ウィンドウ [start, end) を返す。
 * roundSlots: そのブロック・カテゴリの各巡枠数配列 例: [2, 1]
 * currentRound: 1始まり
 */
export function getRoundWindow(
  roundSlots: number[],
  currentRound: number
): { start: number; end: number } {
  const idx = currentRound - 1;
  const start = roundSlots.slice(0, idx).reduce((a, b) => a + (b || 0), 0);
  const size = roundSlots[idx] || 0;
  return { start, end: start + size };
}

/**
 * ジャンケン敗者ブロックの空き枠をeditableに変更した新しいテーブルを返す。
 * losers: { blockName: 負け回数 }
 * blockSlotsForCategory: { blockName: number[] } — 現在のカテゴリの各ブロック枠数配列
 * currentRound: 1始まり
 */
export function computeReentrySlots(
  table: Row[],
  losers: Record<string, number>,
  blockSlotsForCategory: Record<string, number[]>,
  currentRound: number
): Row[] {
  return table.map(row => {
    if (!(row.block in losers)) return row;

    const roundSlots = blockSlotsForCategory[row.block] || [];
    const { start, end } = getRoundWindow(roundSlots, currentRound);
    const endClamped = Math.min(end, row.cells.length);

    // 確定済み・editable の数をカウント
    let confirmedCount = 0;
    let editableCount = 0;
    for (let i = start; i < endClamped; i++) {
      if (row.cells[i].status === "confirmed") confirmedCount++;
      else if (row.cells[i].status === "editable") editableCount++;
    }

    // 必要な追加editable数
    const allowed = Math.max(0, endClamped - start);
    let needed = Math.max(0, allowed - confirmedCount - editableCount);

    // spanセルをneeded個だけeditableに変更
    const newCells = row.cells.map((cell, i) => {
      if (i < start || i >= endClamped) return cell;
      if (cell.status !== "span" || needed <= 0) return cell;
      needed--;
      return { ...cell, status: "editable" as const, value: "" };
    });

    return { ...row, cells: newCells };
  });
}

// ── Feature G: テーブル再描画（get_dict基準） ──

/**
 * totalGetDictに基づいてテーブルを再描画する。
 * - confirmedセル: get_dictの値をソートして先頭から配置、status="confirmed"
 * - 残りのセルはstatus="span"（次ラウンドの枠開放はroundSlots基準で別途行う）
 *
 * table: 現在のテーブル
 * totalGetDict: { blockName: [獲得番号リスト] }
 */
export function rebuildTableFromGetDict(
  table: Row[],
  totalGetDict: Record<string, Array<string | number>>
): Row[] {
  return table.map(row => {
    const vals = totalGetDict[row.block]
      ? Array.from(new Set(totalGetDict[row.block]))
          .map(n => String(n))
          .filter(n => n && n.trim() !== "")
          .sort((a, b) => Number(a) - Number(b))
      : [];

    const newCells = row.cells.map((cell, i) => {
      if (i < vals.length) {
        // 獲得済み番号をconfirmedとして配置
        return { ...cell, value: vals[i], status: "confirmed" as const };
      } else {
        // 残りはspan（空き枠）
        return { ...cell, value: "", status: "span" as const };
      }
    });

    return { ...row, cells: newCells };
  });
}

/**
 * 現在のラウンドの枠をeditableに開放する。
 * rebuildTableFromGetDict の後に呼び出して、入力可能枠を設定する。
 */
export function applyRoundSlots(
  table: Row[],
  blockSlotsForCategory: Record<string, number[]>,
  currentRound: number
): Row[] {
  return table.map(row => {
    const roundSlots = blockSlotsForCategory[row.block] || [];
    const { start, end } = getRoundWindow(roundSlots, currentRound);
    const endClamped = Math.min(end, row.cells.length);

    const newCells = row.cells.map((cell, i) => {
      if (i >= start && i < endClamped && cell.status === "span") {
        return { ...cell, status: "editable" as const };
      }
      return cell;
    });

    return { ...row, cells: newCells };
  });
}
