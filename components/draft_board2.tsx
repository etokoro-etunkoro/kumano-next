"use client";

import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";

import type { Rookie, RookieCategory } from "@/types/rookie";
import type { DraftProgress, DraftPhase } from "@/types/draft-progress";
import {
  createInitialProgress,
  getNextCategory,
  isDraftComplete,
  CATEGORY_ORDER,
  CATEGORY_LABELS,
} from "@/types/draft-progress";
import type { BlockSlotsConfig } from "@/types/block-slots";
import {
  isNewBlockSlotsFormat,
  convertLegacyToNewFormat,
  getBlockCategorySlots,
} from "@/types/block-slots";
import type { Cell, Row } from "@/utils/draftTableUtils";
import {
  getRoundWindow,
  computeReentrySlots,
  rebuildTableFromGetDict,
  applyRoundSlots,
} from "@/utils/draftTableUtils";
import { parseBlockSlotsCsv } from "@/utils/csvParser";

import DraftLog, { type LogEntry } from "./DraftLog";
import DraftStatusBar from "./DraftStatusBar";
import CsvImporter from "./CsvImporter";
import FinalResultModal, { mergeGetDict } from "./FinalResultModal";
import ConflictResolveModal from "./ConflictResolveModal";
import RemainingRookies from "./RemainingRookies";
import { useDraftBackup, type DraftBackup } from "@/hooks/useDraftBackup";

// ── 定数 ──
const API_BASE = "http://localhost:5000";

const DUPLICATE_COLOR_PALETTE = [
  "#fecaca", "#fed7aa", "#fef08a", "#bbf7d0", "#a5f3fc",
  "#bfdbfe", "#ddd6fe", "#fbcfe8", "#e9d5ff", "#fde68a",
];

// ── API helpers ──
async function apiGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } catch (err) {
    console.warn(`API GET ${path} failed:`, err);
    return null;
  }
}

async function apiPost<T>(path: string, body?: unknown): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } catch (err) {
    console.warn(`API POST ${path} failed:`, err);
    return null;
  }
}

// ── 再指名用型 ──
type RenominationState = {
  pendingBlocks: string[];
  emptySlots: Array<{ block: string; count: number }>;
} | null;

type RenominationInput = Record<string, string[]>;

// ── コンポーネント本体 ──
export default function DraftBoard({ initial }: { initial: unknown }) {
  // ═══════════ 1. useState群 ═══════════
  const [rookies, setRookies] = useState<Rookie[]>([]);
  const [draftProgress, setDraftProgress] = useState<DraftProgress>(createInitialProgress(2));
  const [tableState, setTableState] = useState<Row[]>([]);
  const [phase, setPhase] = useState<DraftPhase>("picking");
  const [totalGetDict, setTotalGetDict] = useState<Record<string, Array<string | number>>>({});
  const [allCategoryResults, setAllCategoryResults] = useState<
    Record<string, Record<string, Array<string | number>>>
  >({});
  const [activeBlockSlots, setActiveBlockSlots] = useState<BlockSlotsConfig>({});

  const [showConflictResolve, setShowConflictResolve] = useState(false);
  const [renominationState, setRenominationState] = useState<RenominationState>(null);
  const [renominationInput, setRenominationInput] = useState<RenominationInput>({});

  const [showFinalResult, setShowFinalResult] = useState(false);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [focusedCell, setFocusedCell] = useState<{ block: string; cellIndex: number } | null>(null);

  const tableRef = useRef<HTMLTableElement>(null);

  // ═══════════ 2. useDraftBackup ═══════════
  const {
    saveBackup,
    restoreBackup,
    hasBackup,
    saveToLocalStorage,
    restoreFromLocalStorage,
    hasLocalStorageBackup,
  } = useDraftBackup();

  // ═══════════ 3. useMemo群 ═══════════

  // 競合情報（重複指名を検出）
  const conflictInfo = useMemo(() => {
    const valueToBlocks: Record<string, string[]> = {};
    for (const row of tableState) {
      for (const cell of row.cells) {
        const v = cell.value.trim();
        if (!v || cell.status === "confirmed") continue;
        if (!valueToBlocks[v]) valueToBlocks[v] = [];
        if (!valueToBlocks[v].includes(row.block)) {
          valueToBlocks[v].push(row.block);
        }
      }
    }
    return Object.entries(valueToBlocks)
      .filter(([, blocks]) => blocks.length > 1)
      .map(([value, blocks]) => ({ value, blocks }));
  }, [tableState]);

  // 重複番号の色マップ
  const duplicateColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    conflictInfo.forEach((c, i) => {
      map[c.value] = DUPLICATE_COLOR_PALETTE[i % DUPLICATE_COLOR_PALETTE.length];
    });
    return map;
  }, [conflictInfo]);

  // 再指名時の重複検出
  const renominationDuplicates = useMemo(() => {
    if (!renominationState) return [];
    const valueToBlocks: Record<string, string[]> = {};

    // テーブル上のeditable値
    for (const row of tableState) {
      for (const cell of row.cells) {
        const v = cell.value.trim();
        if (!v || cell.status !== "editable") continue;
        if (!valueToBlocks[v]) valueToBlocks[v] = [];
        if (!valueToBlocks[v].includes(row.block)) {
          valueToBlocks[v].push(row.block);
        }
      }
    }

    // 再指名入力
    for (const [block, values] of Object.entries(renominationInput)) {
      for (const v of values) {
        const trimmed = v.trim();
        if (!trimmed) continue;
        if (!valueToBlocks[trimmed]) valueToBlocks[trimmed] = [];
        if (!valueToBlocks[trimmed].includes(block)) {
          valueToBlocks[trimmed].push(block);
        }
      }
    }

    return Object.entries(valueToBlocks)
      .filter(([, blocks]) => blocks.length > 1)
      .map(([value, blocks]) => ({ value, blocks }));
  }, [tableState, renominationState, renominationInput]);

  // 全競合解決済みか
  const allConflictsResolved = useMemo(() => {
    return phase !== "janken";
  }, [phase]);

  // 全カテゴリの結果を統合（FinalResultModal用）
  const combinedGetDict = useMemo(() => {
    const combined: Record<string, Array<string | number>> = {};
    // 過去カテゴリの結果
    for (const catResult of Object.values(allCategoryResults)) {
      for (const [block, nums] of Object.entries(catResult)) {
        if (!combined[block]) combined[block] = [];
        for (const n of nums) {
          if (!combined[block].includes(n)) combined[block].push(n);
        }
      }
    }
    // 現在カテゴリの結果
    for (const [block, nums] of Object.entries(totalGetDict)) {
      if (!combined[block]) combined[block] = [];
      for (const n of nums) {
        if (!combined[block].includes(n)) combined[block].push(n);
      }
    }
    // ソート
    for (const block of Object.keys(combined)) {
      combined[block].sort((a, b) => Number(a) - Number(b));
    }
    return combined;
  }, [allCategoryResults, totalGetDict]);

  // ═══════════ 4. useCallback群 ═══════════

  const addLog = useCallback((message: string, type: LogEntry["type"] = "info") => {
    const now = new Date();
    const timestamp = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
    setLogEntries((prev) => [...prev, { timestamp, message, type }]);
  }, []);

  const setCellValue = useCallback((block: string, cellIndex: number, value: string) => {
    setTableState((prev) =>
      prev.map((row) => {
        if (row.block !== block) return row;
        return {
          ...row,
          cells: row.cells.map((cell, i) => {
            if (i !== cellIndex) return cell;
            return { ...cell, value };
          }),
        };
      })
    );
  }, []);

  const buildTable = useCallback(
    (config: BlockSlotsConfig, category: RookieCategory, round: number): Row[] => {
      const blocks = Object.keys(config);
      return blocks.map((block) => {
        const catSlots = getBlockCategorySlots(config, block, category);
        const totalCells = catSlots.reduce((a, b) => a + b, 0);
        const { start, end } = getRoundWindow(catSlots, round);
        const cells: Cell[] = [];
        for (let i = 0; i < totalCells; i++) {
          cells.push({
            cycle: i < (catSlots[0] || 0) ? "1st" : "2nd",
            index: i,
            value: "",
            status: i >= start && i < end ? "editable" : "span",
          });
        }
        return { block, cells };
      });
    },
    []
  );

  const handleRookiesImport = useCallback(
    (imported: Rookie[]) => {
      if (imported.length === 0) return;
      const cat = imported[0].category;
      setRookies((prev) => [...prev.filter((r) => r.category !== cat), ...imported]);
      addLog(`${imported.length}名を読み込みました（${cat}）`, "info");
    },
    [addLog]
  );

  const handleBlockSlotsImport = useCallback(
    (config: BlockSlotsConfig, maxRound: number) => {
      setActiveBlockSlots(config);
      const progress: DraftProgress = {
        ...draftProgress,
        maxRound,
      };
      setDraftProgress(progress);
      const table = buildTable(config, progress.category, progress.round);
      setTableState(table);
      addLog(`枠数設定 ${Object.keys(config).length}ブロックを読み込みました`, "info");
    },
    [draftProgress, buildTable, addLog]
  );

  const exportToJSON = useCallback(
    (table: Row[]): Record<string, string[]> => {
      const result: Record<string, string[]> = {};
      for (const row of table) {
        result[row.block] = row.cells
          .filter((c) => c.status === "editable" && c.value.trim())
          .map((c) => c.value.trim());
      }
      return result;
    },
    []
  );

  const getRookieName = useCallback(
    (num: string): string | null => {
      const n = parseInt(num, 10);
      if (isNaN(n)) return null;
      const r = rookies.find(
        (rk) => rk.id === n && rk.category === draftProgress.category
      );
      return r?.name || null;
    },
    [rookies, draftProgress.category]
  );

  const handleCategoryTabClick = useCallback(
    (targetCat: RookieCategory) => {
      if (targetCat === draftProgress.category) return;

      // 現在のカテゴリ結果を保存
      if (Object.keys(totalGetDict).length > 0) {
        setAllCategoryResults((prev) => ({
          ...prev,
          [draftProgress.category]: totalGetDict,
        }));
      }

      // ターゲットカテゴリに結果があれば復元
      const saved = allCategoryResults[targetCat];
      if (saved) {
        setTotalGetDict(saved);
        const restored = rebuildTableFromGetDict(
          buildTable(activeBlockSlots, targetCat, 1),
          saved
        );
        setTableState(restored);
        setPhase("confirmed");
      } else {
        // 未着手カテゴリ
        setTotalGetDict({});
        const table = buildTable(activeBlockSlots, targetCat, 1);
        setTableState(table);
        setPhase("picking");
      }

      setDraftProgress((prev) => ({ ...prev, category: targetCat }));
      setRenominationState(null);
    },
    [
      draftProgress.category,
      totalGetDict,
      allCategoryResults,
      activeBlockSlots,
      buildTable,
    ]
  );

  const handleConfirmNominations = useCallback(() => {
    // ── BUG-1: 確定済み番号の再指名防止 ──
    const allConfirmedNums = new Set<string>();
    for (const nums of Object.values(totalGetDict)) {
      for (const n of nums) {
        allConfirmedNums.add(String(n).trim());
      }
    }
    for (const row of tableState) {
      for (const cell of row.cells) {
        if (cell.status !== "editable") continue;
        const v = cell.value.trim();
        if (!v) continue;
        if (allConfirmedNums.has(v)) {
          alert(`No.${v} は既に確定済みです。別の番号を指名してください。`);
          return;
        }
      }
    }

    // ── BUG-2: 同一ブロック内の重複指名防止 ──
    for (const row of tableState) {
      const seen = new Set<string>();
      for (const cell of row.cells) {
        if (cell.status !== "editable") continue;
        const v = cell.value.trim();
        if (!v) continue;
        if (seen.has(v)) {
          alert(
            `${row.block} で No.${v} が重複しています。同一ブロック内で同じ番号は指名できません。`
          );
          return;
        }
        seen.add(v);
      }
    }

    // ── BUG-4: 存在しない番号の指名防止 ──
    const catRookies = rookies.filter(
      (r) => r.category === draftProgress.category
    );
    if (catRookies.length > 0) {
      const validIds = new Set(catRookies.map((r) => r.id));
      for (const row of tableState) {
        for (const cell of row.cells) {
          if (cell.status !== "editable") continue;
          const v = cell.value.trim();
          if (!v) continue;
          const num = Number(v);
          if (!validIds.has(num)) {
            alert(
              `No.${v} は現在のカテゴリに存在しません。正しい番号を入力してください。`
            );
            return;
          }
        }
      }
    }

    const roundData = exportToJSON(tableState);
    apiPost("/submit", { round_data: roundData });

    if (conflictInfo.length > 0) {
      setPhase("janken");
      setShowConflictResolve(true);
      addLog("重複指名を検出。勝者選択へ", "warn");
    } else {
      // 競合なし → 直接確定
      const currentGetDict: Record<string, Array<string | number>> = {};
      for (const row of tableState) {
        currentGetDict[row.block] = row.cells
          .filter((c) => c.value.trim() && c.status !== "span")
          .map((c) => c.value.trim());
      }
      setTotalGetDict((prev) => mergeGetDict(prev, currentGetDict));
      setPhase("confirmed");
      setDraftProgress((prev) => ({ ...prev, phase: "confirmed" }));
      addLog("指名を確定しました", "info");
    }
  }, [tableState, conflictInfo, exportToJSON, addLog, rookies, draftProgress.category, totalGetDict]);

  const handleConflictResolve = useCallback(
    (winnersMap: Record<string, string>) => {
      setShowConflictResolve(false);

      // サーバーに同期
      for (const [rookieNumber, winner] of Object.entries(winnersMap)) {
        apiPost("/resolve_conflict", { val: rookieNumber, winner });
        addLog(`No.${rookieNumber} の勝者: ${winner}`, "winner");
      }

      // 敗者を特定
      const losers = new Map<string, number>();
      // 競合ソースを判定（再指名 or 通常）
      const conflicts = renominationDuplicates.length > 0 ? renominationDuplicates : conflictInfo;

      conflicts.forEach((conflict) => {
        const winner = winnersMap[conflict.value];
        if (winner) {
          conflict.blocks.forEach((block) => {
            if (block !== winner) {
              losers.set(block, (losers.get(block) || 0) + 1);
            }
          });
        }
      });

      // 敗者ブロックのセルをクリア
      setTableState((prev) =>
        prev.map((row) => {
          if (!losers.has(row.block)) return row;
          return {
            ...row,
            cells: row.cells.map((cell) => {
              const isLostValue = conflicts.some((c) => {
                const winner = winnersMap[c.value];
                return (
                  winner &&
                  winner !== row.block &&
                  c.blocks.includes(row.block) &&
                  cell.value.trim() === c.value
                );
              });
              return isLostValue ? { ...cell, value: "" } : cell;
            }),
          };
        })
      );

      if (losers.size > 0) {
        // 敗者がいる → 再指名フェーズへ
        const pendingBlocks = Array.from(losers.keys());
        const emptySlots = Array.from(losers.entries()).map(([block, count]) => ({
          block,
          count,
        }));
        setRenominationState({ pendingBlocks, emptySlots });
        const initialInput: RenominationInput = {};
        pendingBlocks.forEach((block) => {
          initialInput[block] = [];
        });
        setRenominationInput(initialInput);
        setPhase("picking");
        addLog("敗者ブロックの再指名フェーズへ", "warn");
      } else {
        // 全勝者確定 → ラウンド確定
        const currentGetDict: Record<string, Array<string | number>> = {};
        for (const row of tableState) {
          currentGetDict[row.block] = row.cells
            .filter((c) => c.value.trim() && c.status !== "span")
            .map((c) => c.value.trim());
        }
        setTotalGetDict((prev) => mergeGetDict(prev, currentGetDict));
        setRenominationState(null);
        setPhase("confirmed");
        setDraftProgress((prev) => ({ ...prev, phase: "confirmed" }));
        addLog("ラウンド確定", "info");
      }
    },
    [conflictInfo, renominationDuplicates, tableState, addLog]
  );

  const handleConflictResolveClose = useCallback(() => {
    setShowConflictResolve(false);
    setPhase("picking");
  }, []);

  const handleConfirmRenomination = useCallback(() => {
    if (renominationDuplicates.length > 0) {
      setPhase("janken");
      setShowConflictResolve(true);
      addLog("再指名で重複を検出。勝者選択へ", "warn");
    } else {
      // 再指名の結果を確定
      const currentGetDict: Record<string, Array<string | number>> = {};
      for (const row of tableState) {
        currentGetDict[row.block] = row.cells
          .filter((c) => c.value.trim() && c.status !== "span")
          .map((c) => c.value.trim());
      }
      setTotalGetDict((prev) => mergeGetDict(prev, currentGetDict));
      setRenominationState(null);
      setPhase("confirmed");
      setDraftProgress((prev) => ({ ...prev, phase: "confirmed" }));
      addLog("再指名を確定しました", "info");
    }
  }, [renominationDuplicates, tableState, addLog]);

  const handlePhaseAction = useCallback(() => {
    if (renominationState) {
      handleConfirmRenomination();
    } else {
      handleConfirmNominations();
    }
  }, [renominationState, handleConfirmRenomination, handleConfirmNominations]);

  const handleNextRound = useCallback(() => {
    const nextRound = draftProgress.round + 1;
    if (nextRound > draftProgress.maxRound) {
      // カテゴリ終了 → 最終結果 or 次カテゴリ
      const nextCat = getNextCategory(draftProgress.category);
      if (!nextCat) {
        setShowFinalResult(true);
      }
      // maxRound超過: 次カテゴリボタンで遷移させる
      return;
    }

    apiPost("/next_round", { round: nextRound });

    // activeBlockSlots を使ってテーブル再構築
    const cat = draftProgress.category;
    const blockSlotsForCat: Record<string, number[]> = {};
    for (const block of Object.keys(activeBlockSlots)) {
      blockSlotsForCat[block] = getBlockCategorySlots(activeBlockSlots, block, cat);
    }

    let newTable = rebuildTableFromGetDict(tableState, totalGetDict);
    newTable = applyRoundSlots(newTable, blockSlotsForCat, nextRound);

    setTableState(newTable);
    const newProgress: DraftProgress = {
      ...draftProgress,
      round: nextRound,
      phase: "picking",
    };
    setDraftProgress(newProgress);
    setPhase("picking");
    setRenominationState(null);
    addLog(`第${nextRound}巡を開始`, "info");
  }, [draftProgress, tableState, totalGetDict, activeBlockSlots, addLog]);

  const handleNextCategory = useCallback(() => {
    const nextCat = getNextCategory(draftProgress.category);
    if (!nextCat) {
      setShowFinalResult(true);
      addLog("全カテゴリ完了！", "info");
      return;
    }

    // 現カテゴリの結果を保存してからリセット
    if (Object.keys(totalGetDict).length > 0) {
      setAllCategoryResults((prev) => ({
        ...prev,
        [draftProgress.category]: totalGetDict,
      }));
    }

    apiPost("/next_category", { category: nextCat });

    const table = buildTable(activeBlockSlots, nextCat, 1);
    setTableState(table);
    const newProgress: DraftProgress = {
      category: nextCat,
      round: 1,
      maxRound: draftProgress.maxRound,
      phase: "picking",
    };
    setDraftProgress(newProgress);
    setPhase("picking");
    setTotalGetDict({});
    setRenominationState(null);
    addLog(`${CATEGORY_LABELS[nextCat]}ドラフトを開始`, "info");
  }, [draftProgress, activeBlockSlots, buildTable, addLog, totalGetDict]);

  const handleSaveState = useCallback(() => {
    const backup: DraftBackup = {
      savedAt: new Date().toISOString(),
      round: draftProgress.round,
      category: draftProgress.category,
      tableData: tableState.map((row) => ({
        block: row.block,
        cells: row.cells.map((c) => ({
          cycle: c.cycle,
          index: c.index,
          value: c.value,
          status: c.status,
        })),
      })),
      totalGetDict,
      draftProgress: { ...draftProgress },
    };
    saveBackup(backup);
    saveToLocalStorage(backup);
    addLog("状態を保存しました", "info");
  }, [draftProgress, tableState, totalGetDict, saveBackup, saveToLocalStorage, addLog]);

  const handleRestoreState = useCallback(() => {
    const backup = restoreBackup() || restoreFromLocalStorage();
    if (!backup) return;
    setDraftProgress(backup.draftProgress as DraftProgress);
    setTableState(
      backup.tableData.map((row) => ({
        block: row.block,
        cells: row.cells.map((c) => ({ ...c })),
      }))
    );
    setTotalGetDict(backup.totalGetDict);
    setPhase((backup.draftProgress.phase as DraftPhase) || "picking");
    addLog("状態を復元しました", "info");
  }, [restoreBackup, restoreFromLocalStorage, addLog]);

  const handleCellKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, block: string, cellIndex: number) => {
      const row = tableState.find((r) => r.block === block);
      if (!row) return;

      // 同じ行内のeditableセルのインデックスリスト
      const editableIndices = row.cells
        .map((c, i) => (c.status === "editable" ? i : -1))
        .filter((i) => i >= 0);
      const posInEditable = editableIndices.indexOf(cellIndex);

      if (e.key === "ArrowRight" || e.key === "Tab") {
        e.preventDefault();
        if (posInEditable < editableIndices.length - 1) {
          setFocusedCell({ block, cellIndex: editableIndices[posInEditable + 1] });
        } else {
          // 次のブロックの最初のeditableセル
          const blockIndex = tableState.findIndex((r) => r.block === block);
          for (let bi = blockIndex + 1; bi < tableState.length; bi++) {
            const nextEditable = tableState[bi].cells.findIndex(
              (c) => c.status === "editable"
            );
            if (nextEditable >= 0) {
              setFocusedCell({ block: tableState[bi].block, cellIndex: nextEditable });
              break;
            }
          }
        }
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (posInEditable > 0) {
          setFocusedCell({ block, cellIndex: editableIndices[posInEditable - 1] });
        } else {
          const blockIndex = tableState.findIndex((r) => r.block === block);
          for (let bi = blockIndex - 1; bi >= 0; bi--) {
            const prevRow = tableState[bi];
            const prevEditables = prevRow.cells
              .map((c, i) => (c.status === "editable" ? i : -1))
              .filter((i) => i >= 0);
            if (prevEditables.length > 0) {
              setFocusedCell({
                block: prevRow.block,
                cellIndex: prevEditables[prevEditables.length - 1],
              });
              break;
            }
          }
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        const blockIndex = tableState.findIndex((r) => r.block === block);
        for (let bi = blockIndex + 1; bi < tableState.length; bi++) {
          const nextRow = tableState[bi];
          if (cellIndex < nextRow.cells.length && nextRow.cells[cellIndex].status === "editable") {
            setFocusedCell({ block: nextRow.block, cellIndex });
            break;
          }
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const blockIndex = tableState.findIndex((r) => r.block === block);
        for (let bi = blockIndex - 1; bi >= 0; bi--) {
          const prevRow = tableState[bi];
          if (cellIndex < prevRow.cells.length && prevRow.cells[cellIndex].status === "editable") {
            setFocusedCell({ block: prevRow.block, cellIndex });
            break;
          }
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        // 次のブロック同列
        const blockIndex = tableState.findIndex((r) => r.block === block);
        for (let bi = blockIndex + 1; bi < tableState.length; bi++) {
          const nextRow = tableState[bi];
          if (cellIndex < nextRow.cells.length && nextRow.cells[cellIndex].status === "editable") {
            setFocusedCell({ block: nextRow.block, cellIndex });
            return;
          }
        }
        // 末尾まで行ったら次のeditableセル
        if (posInEditable < editableIndices.length - 1) {
          setFocusedCell({ block, cellIndex: editableIndices[posInEditable + 1] });
        }
      }
    },
    [tableState]
  );

  const handleQuickSet = useCallback(async () => {
    try {
      // rookies CSV — 3カテゴリ読み込み
      const csvFiles: Array<{ file: string; category: RookieCategory }> = [
        { file: "/devdata/rookies.csv", category: "freshman" },
        { file: "/devdata/rookies_upperclassman.csv", category: "upperclassman" },
        { file: "/devdata/rookies_temporary.csv", category: "temporary" },
      ];
      const allRookies: Rookie[] = [];
      for (const { file, category } of csvFiles) {
        try {
          const res = await fetch(file);
          if (!res.ok) continue;
          const text = (await res.text()).replace(/^\uFEFF/, "");
          for (const line of text.split("\n")) {
            const parts = line.trim().split(",");
            const num = parseInt(parts[0], 10);
            if (isNaN(num)) continue;
            allRookies.push({
              id: num,
              name: parts[1]?.trim() || "",
              category,
              remaining: true,
            });
          }
        } catch {
          // ファイルが存在しない場合は無視
        }
      }
      setRookies(allRookies);

      // block_slots CSV
      const slotsRes = await fetch("/devdata/block_slots.csv");
      const slotsText = (await slotsRes.text()).replace(/^\uFEFF/, "");
      const { config, maxRound } = parseBlockSlotsCsv(slotsText);

      setActiveBlockSlots(config);
      const progress: DraftProgress = { ...draftProgress, maxRound };
      setDraftProgress(progress);
      const table = buildTable(config, progress.category, progress.round);
      setTableState(table);
      addLog(`デフォルトデータをセットしました（${allRookies.length}名）`, "info");
    } catch (err) {
      console.error("Quick set failed:", err);
      addLog("データセット失敗", "error");
    }
  }, [draftProgress, buildTable, addLog]);

  // ═══════════ 5. useEffect群 ═══════════

  // フォーカス制御
  useEffect(() => {
    if (!focusedCell || !tableRef.current) return;
    const input = tableRef.current.querySelector(
      `input[data-block="${focusedCell.block}"][data-cell="${focusedCell.cellIndex}"]`
    ) as HTMLInputElement | null;
    if (input) {
      input.focus();
      input.select();
    }
  }, [focusedCell]);

  // ═══════════ JSX ═══════════

  const isComplete = isDraftComplete(draftProgress) && phase === "confirmed";

  // ヘッダーカラム数（最大セル数）
  const maxCells = tableState.reduce((max, row) => Math.max(max, row.cells.length), 0);

  return (
    <div className="container">
      <h1 className="h1">熊野寮ドラフト会議</h1>
      <p className="sub">新入寮生の部屋割りドラフトシステム</p>

      {/* CSV インポート */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 8px' }}>データ読込</h3>
        {process.env.NODE_ENV === "development" && (
          <button
            type="button"
            style={{
              margin: "0 0 8px 0",
              padding: "8px 16px",
              background: "#fbbf24",
              border: "1px solid #d97706",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: 13,
            }}
            onClick={handleQuickSet}
          >
            開発用: デフォルトデータをセット
          </button>
        )}
        <CsvImporter
          onRookiesImport={handleRookiesImport}
          onBlockSlotsImport={handleBlockSlotsImport}
        />
      </div>

      {/* 操作ガイド（データ未読込時のみ） */}
      {tableState.length === 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 8px', color: 'var(--text)' }}>操作手順</h3>
          <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6, margin: 0 }}>
            ① CSVまたはクイックセットでデータを読み込む → ② 各ブロックの枠に番号を入力 → ③ 指名終了ボタンで確定
          </p>
        </div>
      )}

      {/* ステータスバー */}
      <DraftStatusBar
        progress={draftProgress}
        onConfirm={handlePhaseAction}
        onNextRound={handleNextRound}
        onNextCategory={handleNextCategory}
        hasConflicts={conflictInfo.length > 0}
        allConflictsResolved={allConflictsResolved}
        disabled={phase === "confirmed" || tableState.length === 0}
        onSaveState={handleSaveState}
        onRestoreState={handleRestoreState}
        hasSavedState={hasBackup || hasLocalStorageBackup}
        isLocked={isComplete || showFinalResult}
      />

      {/* 2カラムレイアウト */}
      <div className="two-column-layout">
        <div className="main-column">
          {/* UI-1: カテゴリタブ */}
          {tableState.length > 0 && (
            <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
              {CATEGORY_ORDER.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => handleCategoryTabClick(cat)}
                  style={{
                    padding: "8px 20px",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    cursor: "pointer",
                    fontWeight: cat === draftProgress.category ? 700 : 400,
                    background:
                      cat === draftProgress.category
                        ? "rgba(120,170,255,0.25)"
                        : "var(--panel2)",
                    color: "var(--text)",
                    fontSize: 14,
                  }}
                >
                  {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
          )}

          {/* テーブル */}
          {tableState.length > 0 && (
            <div className="card" style={{ overflowX: "auto", marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 8px' }}>指名テーブル</h3>
              <table className="slots-table" ref={tableRef}>
                <thead>
                  <tr>
                    <th>ブロック</th>
                    {Array.from({ length: maxCells }, (_, i) => (
                      <th key={i}>枠{i + 1}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableState.map((row) => (
                    <tr key={row.block}>
                      <td style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{row.block}</td>
                      {row.cells.map((cell, ci) => {
                        const v = cell.value.trim();
                        const dupColor = v ? duplicateColorMap[v] : undefined;
                        const isConfirmed = cell.status === "confirmed";
                        const isEditable = cell.status === "editable";
                        const isSpan = cell.status === "span";

                        return (
                          <td
                            key={ci}
                            className={`${isConfirmed ? "cell-black" : isEditable ? "cell-red" : ""} ${isSpan ? "cell-span" : ""} ${dupColor ? "cell-duplicate" : ""}`}
                            style={dupColor ? { backgroundColor: dupColor } : undefined}
                          >
                            {isEditable && phase !== "confirmed" ? (
                              <div>
                                <input
                                  className="cell-input"
                                  data-block={row.block}
                                  data-cell={ci}
                                  value={cell.value}
                                  onChange={(e) => setCellValue(row.block, ci, e.target.value)}
                                  onKeyDown={(e) => handleCellKeyDown(e, row.block, ci)}
                                />
                                {(() => {
                                  const name = getRookieName(cell.value.trim());
                                  return name ? (
                                    <div style={{ fontSize: 11, color: "#666", marginTop: 1 }}>
                                      {name}
                                    </div>
                                  ) : null;
                                })()}
                              </div>
                            ) : isEditable && phase === "confirmed" ? (
                              <span>
                                {cell.value.trim()
                                  ? `${cell.value.trim()}${(() => {
                                      const name = getRookieName(cell.value.trim());
                                      return name ? ` ${name}` : "";
                                    })()}`
                                  : ""}
                              </span>
                            ) : isConfirmed ? (
                              <span>
                                {cell.value.trim()
                                  ? `${cell.value.trim()}${(() => {
                                      const name = getRookieName(cell.value.trim());
                                      return name ? ` ${name}` : "";
                                    })()}`
                                  : cell.value}
                              </span>
                            ) : (
                              <span>&nbsp;</span>
                            )}
                          </td>
                        );
                      })}
                      {/* パディング列 */}
                      {row.cells.length < maxCells &&
                        Array.from({ length: maxCells - row.cells.length }, (_, i) => (
                          <td key={`pad-${i}`}>&nbsp;</td>
                        ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 競合サマリー */}
          {conflictInfo.length > 0 && phase !== "confirmed" && (
            <div className="conflict-summary">
              <p className="conflict-title">重複指名あり</p>
              <ul className="conflict-list">
                {conflictInfo.map((c) => (
                  <li key={c.value} className="conflict-item">
                    <span
                      className="conflict-number"
                      style={{ backgroundColor: duplicateColorMap[c.value] }}
                    >
                      No.{c.value}
                    </span>
                    <span className="conflict-blocks">{c.blocks.join(" vs ")}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="side-column">
          {/* 残り新入寮生一覧 */}
          {rookies.length > 0 && (
            <RemainingRookies
              rookies={rookies.map((r) => ({ id: r.id, name: r.name, category: r.category }))}
              getDict={totalGetDict}
              category={draftProgress.category}
            />
          )}

          {/* ドラフトログ */}
          <DraftLog entries={logEntries} />
        </div>
      </div>

      {/* 競合解決モーダル */}
      {showConflictResolve && (
        <ConflictResolveModal
          conflicts={
            renominationDuplicates.length > 0
              ? renominationDuplicates.map((d) => ({ val: d.value, blocks: d.blocks }))
              : conflictInfo.map((c) => ({ val: c.value, blocks: c.blocks }))
          }
          onResolve={handleConflictResolve}
          onClose={handleConflictResolveClose}
        />
      )}

      {/* 最終結果モーダル */}
      <FinalResultModal
        isOpen={showFinalResult}
        onClose={() => setShowFinalResult(false)}
        totalGetDict={combinedGetDict}
      />
    </div>
  );
}
