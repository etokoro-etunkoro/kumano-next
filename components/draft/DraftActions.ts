"use client";

import React, { useCallback } from "react";

import type { Rookie, RookieCategory } from "@/types/rookie";
import type { DraftProgress, DraftPhase } from "@/types/draft-progress";
import {
  getNextCategory,
  CATEGORY_LABELS,
} from "@/types/draft-progress";
import type { BlockSlotsConfig } from "@/types/block-slots";
import { getBlockCategorySlots } from "@/types/block-slots";
import type { Cell, Row } from "@/utils/draftTableUtils";
import {
  getRoundWindow,
  rebuildTableFromGetDict,
  applyRoundSlots,
} from "@/utils/draftTableUtils";
import { parseBlockSlotsCsv } from "@/utils/csvParser";
import type { LogEntry } from "../DraftLog";
import { mergeGetDict } from "../FinalResultModal";
import type { DraftBackup } from "@/hooks/useDraftBackup";
import { apiPost } from "./constants";
import type { RenominationInput } from "./types";
import type { useDraftState } from "./useDraftState";

type DraftState = ReturnType<typeof useDraftState>;

export function useDraftActions(s: DraftState) {
  const addLog = useCallback((message: string, type: LogEntry["type"] = "info") => {
    const now = new Date();
    const timestamp = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
    s.setLogEntries((prev) => [...prev, { timestamp, message, type }]);
  }, [s.setLogEntries]);

  const setCellValue = useCallback((block: string, cellIndex: number, value: string) => {
    s.setTableState((prev) =>
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
  }, [s.setTableState]);

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
      s.setRookies((prev) => [...prev.filter((r) => r.category !== cat), ...imported]);
      addLog(`${imported.length}名を読み込みました（${cat}）`, "info");
    },
    [addLog, s.setRookies]
  );

  const handleBlockSlotsImport = useCallback(
    (config: BlockSlotsConfig, maxRound: number) => {
      s.setActiveBlockSlots(config);
      const progress: DraftProgress = {
        ...s.draftProgress,
        maxRound,
      };
      s.setDraftProgress(progress);
      const table = buildTable(config, progress.category, progress.round);
      s.setTableState(table);
      addLog(`枠数設定 ${Object.keys(config).length}ブロックを読み込みました`, "info");
    },
    [s.draftProgress, buildTable, addLog, s.setActiveBlockSlots, s.setDraftProgress, s.setTableState]
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
      const r = s.rookies.find(
        (rk) => rk.id === n && rk.category === s.draftProgress.category
      );
      return r?.name || null;
    },
    [s.rookies, s.draftProgress.category]
  );

  const handleCategoryTabClick = useCallback(
    (targetCat: RookieCategory) => {
      if (targetCat === s.draftProgress.category) return;

      // 現在のカテゴリの round/phase を保存
      s.setCategoryProgressMap((prev) => ({
        ...prev,
        [s.draftProgress.category]: {
          round: s.draftProgress.round,
          phase: s.phase,
        },
      }));

      if (Object.keys(s.totalGetDict).length > 0) {
        s.setAllCategoryResults((prev) => ({
          ...prev,
          [s.draftProgress.category]: s.totalGetDict,
        }));
      }

      // 切り替え先カテゴリの round/phase を復元
      const savedProgress = s.categoryProgressMap[targetCat];
      const restoredRound = savedProgress?.round ?? 1;
      const restoredPhase = savedProgress?.phase ?? "picking";

      const saved = s.allCategoryResults[targetCat];
      if (saved) {
        s.setTotalGetDict(saved);
        const restored = rebuildTableFromGetDict(
          buildTable(s.activeBlockSlots, targetCat, restoredRound),
          saved
        );
        s.setTableState(restored);
        s.setPhase(restoredPhase);
      } else {
        s.setTotalGetDict({});
        const table = buildTable(s.activeBlockSlots, targetCat, restoredRound);
        s.setTableState(table);
        s.setPhase(restoredPhase);
      }

      s.setDraftProgress((prev) => ({
        ...prev,
        category: targetCat,
        round: restoredRound,
        phase: restoredPhase,
      }));
      s.setRenominationState(null);
    },
    [
      s.draftProgress.category, s.draftProgress.round, s.phase,
      s.totalGetDict, s.allCategoryResults, s.categoryProgressMap,
      s.activeBlockSlots, buildTable,
      s.setCategoryProgressMap, s.setAllCategoryResults, s.setTotalGetDict,
      s.setTableState, s.setPhase, s.setDraftProgress, s.setRenominationState,
    ]
  );

  const handleConfirmNominations = useCallback(() => {
    const allConfirmedNums = new Set<string>();
    for (const nums of Object.values(s.totalGetDict)) {
      for (const n of nums) {
        allConfirmedNums.add(String(n).trim());
      }
    }
    for (const row of s.tableState) {
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

    for (const row of s.tableState) {
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

    const catRookies = s.rookies.filter(
      (r) => r.category === s.draftProgress.category
    );
    if (catRookies.length > 0) {
      const validIds = new Set(catRookies.map((r) => r.id));
      for (const row of s.tableState) {
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

    const roundData = exportToJSON(s.tableState);
    apiPost("/submit", { round_data: roundData });

    if (s.conflictInfo.length > 0) {
      // 非競合セルを即座に confirmed にする
      const conflictValues = new Set(s.conflictInfo.map(c => c.value));
      const nonConflictGetDict: Record<string, Array<string | number>> = {};
      for (const row of s.tableState) {
        for (const cell of row.cells) {
          if (cell.status !== "editable") continue;
          const v = cell.value.trim();
          if (!v || conflictValues.has(v)) continue;
          if (!nonConflictGetDict[row.block]) nonConflictGetDict[row.block] = [];
          nonConflictGetDict[row.block].push(v);
        }
      }
      s.setTableState(prev => prev.map(row => ({
        ...row,
        cells: row.cells.map(cell => {
          if (cell.status !== "editable") return cell;
          const v = cell.value.trim();
          if (!v || conflictValues.has(v)) return cell;
          return { ...cell, status: "confirmed" as const };
        }),
      })));
      if (Object.keys(nonConflictGetDict).length > 0) {
        s.setTotalGetDict(prev => mergeGetDict(prev, nonConflictGetDict));
      }

      s.setPhase("janken");
      s.setShowConflictResolve(true);
      addLog("重複指名を検出。勝者選択へ", "warn");
    } else {
      const currentGetDict: Record<string, Array<string | number>> = {};
      for (const row of s.tableState) {
        currentGetDict[row.block] = row.cells
          .filter((c) => c.value.trim() && c.status !== "span")
          .map((c) => c.value.trim());
      }
      s.setTotalGetDict((prev) => mergeGetDict(prev, currentGetDict));
      s.setPhase("confirmed");
      s.setDraftProgress((prev) => ({ ...prev, phase: "confirmed" }));
      addLog("指名を確定しました", "info");
    }
  }, [
    s.tableState, s.conflictInfo, exportToJSON, addLog,
    s.rookies, s.draftProgress.category, s.totalGetDict,
    s.setPhase, s.setShowConflictResolve, s.setTotalGetDict, s.setDraftProgress, s.setTableState,
  ]);

  const handleConflictResolve = useCallback(
    (winnersMap: Record<string, string>) => {
      s.setShowConflictResolve(false);

      for (const [rookieNumber, winner] of Object.entries(winnersMap)) {
        apiPost("/resolve_conflict", { val: rookieNumber, winner });
        addLog(`No.${rookieNumber} の勝者: ${winner}`, "winner");
      }

      const losers = new Map<string, number>();
      const conflicts = s.renominationDuplicates.length > 0 ? s.renominationDuplicates : s.conflictInfo;

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

      s.setTableState((prev) =>
        prev.map((row) => {
          return {
            ...row,
            cells: row.cells.map((cell) => {
              const v = cell.value.trim();
              if (!v) return cell;

              // じゃんけん勝者のセルを confirmed に変更
              const isWinnerValue = conflicts.some((c) => {
                const winner = winnersMap[c.value];
                return winner === row.block && v === c.value;
              });
              if (isWinnerValue) {
                return { ...cell, status: "confirmed" as const };
              }

              // 敗者のセルをクリア
              if (losers.has(row.block)) {
                const isLostValue = conflicts.some((c) => {
                  const winner = winnersMap[c.value];
                  return (
                    winner &&
                    winner !== row.block &&
                    c.blocks.includes(row.block) &&
                    v === c.value
                  );
                });
                if (isLostValue) {
                  return { ...cell, value: "" };
                }
              }

              return cell;
            }),
          };
        })
      );

      if (losers.size > 0) {
        // 勝者分を totalGetDict に即時追加（再指名で重複させないため）
        const winnerGetDict: Record<string, Array<string | number>> = {};
        conflicts.forEach((conflict) => {
          const winner = winnersMap[conflict.value];
          if (winner) {
            if (!winnerGetDict[winner]) winnerGetDict[winner] = [];
            winnerGetDict[winner].push(conflict.value);
          }
        });
        if (Object.keys(winnerGetDict).length > 0) {
          s.setTotalGetDict(prev => mergeGetDict(prev, winnerGetDict));
        }

        // 確定セルを番号順に詰めて再配置、敗者空きセルを editable に
        const fullGetDict = mergeGetDict(s.totalGetDict, winnerGetDict);
        s.setTableState(prev => prev.map(row => {
          const vals = fullGetDict[row.block]
            ? Array.from(new Set(fullGetDict[row.block]))
                .map(n => String(n)).filter(n => n.trim() !== "")
                .sort((a, b) => Number(a) - Number(b))
            : [];
          const loserEmpty = losers.get(row.block) || 0;
          let cIdx = 0;
          let eIdx = 0;
          return {
            ...row,
            cells: row.cells.map(cell => {
              if (cell.status === "span") return cell;
              if (cIdx < vals.length) {
                return { ...cell, value: vals[cIdx++], status: "confirmed" as const };
              }
              if (eIdx < loserEmpty) {
                eIdx++;
                return { ...cell, value: "", status: "editable" as const };
              }
              return cell;
            }),
          };
        }));

        const pendingBlocks = Array.from(losers.keys());
        const emptySlots = Array.from(losers.entries()).map(([block, count]) => ({
          block,
          count,
        }));
        s.setRenominationState({ pendingBlocks, emptySlots });
        const initialInput: RenominationInput = {};
        pendingBlocks.forEach((block) => {
          initialInput[block] = [];
        });
        s.setRenominationInput(initialInput);
        s.setPhase("picking");
        addLog("敗者ブロックの再指名フェーズへ", "warn");
      } else {
        const currentGetDict: Record<string, Array<string | number>> = {};
        for (const row of s.tableState) {
          currentGetDict[row.block] = row.cells
            .filter((c) => c.value.trim() && c.status !== "span")
            .map((c) => c.value.trim());
        }
        s.setTotalGetDict((prev) => mergeGetDict(prev, currentGetDict));
        s.setRenominationState(null);
        s.setPhase("confirmed");
        s.setDraftProgress((prev) => ({ ...prev, phase: "confirmed" }));
        addLog("ラウンド確定", "info");
      }
    },
    [
      s.conflictInfo, s.renominationDuplicates, s.tableState, addLog,
      s.setShowConflictResolve, s.setTableState, s.setRenominationState,
      s.setRenominationInput, s.setPhase, s.setTotalGetDict, s.setDraftProgress,
    ]
  );

  const handleConflictResolveClose = useCallback(() => {
    s.setShowConflictResolve(false);
    s.setPhase("picking");
  }, [s.setShowConflictResolve, s.setPhase]);

  const handleConfirmRenomination = useCallback(() => {
    // バリデーション: 確定済み番号チェック
    const allConfirmedNums = new Set<string>();
    for (const nums of Object.values(s.totalGetDict)) {
      for (const n of nums) allConfirmedNums.add(String(n).trim());
    }

    // renominationInput の確定済み番号チェック
    for (const [block, values] of Object.entries(s.renominationInput)) {
      for (const v of values) {
        const trimmed = v.trim();
        if (!trimmed) continue;
        if (allConfirmedNums.has(trimmed)) {
          alert(`No.${trimmed} は既に確定済みです（${block}）。別の番号を指名してください。`);
          return;
        }
      }
    }

    // tableState の editable セルの確定済み番号チェック
    for (const row of s.tableState) {
      for (const cell of row.cells) {
        if (cell.status !== "editable") continue;
        const v = cell.value.trim();
        if (!v) continue;
        if (allConfirmedNums.has(v)) {
          alert(`No.${v} は既に確定済みです（${row.block}）。別の番号を指名してください。`);
          return;
        }
      }
    }

    // 同一ブロック内重複チェック（renominationInput）
    for (const [block, values] of Object.entries(s.renominationInput)) {
      const seen = new Set<string>();
      for (const v of values) {
        const trimmed = v.trim();
        if (!trimmed) continue;
        if (seen.has(trimmed)) {
          alert(`${block} で No.${trimmed} が重複しています。同一ブロック内で同じ番号は指名できません。`);
          return;
        }
        seen.add(trimmed);
      }
    }

    // 存在しない番号チェック
    const catRookies = s.rookies.filter(
      (r) => r.category === s.draftProgress.category
    );
    if (catRookies.length > 0) {
      const validIds = new Set(catRookies.map((r) => r.id));
      for (const [block, values] of Object.entries(s.renominationInput)) {
        for (const v of values) {
          const trimmed = v.trim();
          if (!trimmed) continue;
          const num = Number(trimmed);
          if (!validIds.has(num)) {
            alert(`No.${trimmed} は現在のカテゴリに存在しません（${block}）。正しい番号を入力してください。`);
            return;
          }
        }
      }
    }

    if (s.renominationDuplicates.length > 0) {
      // 非競合の再指名を即座に confirmed にする
      const conflictValues = new Set(s.renominationDuplicates.map(c => c.value));
      const nonConflictGetDict: Record<string, Array<string | number>> = {};
      for (const row of s.tableState) {
        for (const cell of row.cells) {
          if (cell.status !== "editable") continue;
          const v = cell.value.trim();
          if (!v || conflictValues.has(v)) continue;
          if (!nonConflictGetDict[row.block]) nonConflictGetDict[row.block] = [];
          nonConflictGetDict[row.block].push(v);
        }
      }
      s.setTableState(prev => prev.map(row => ({
        ...row,
        cells: row.cells.map(cell => {
          if (cell.status !== "editable") return cell;
          const v = cell.value.trim();
          if (!v || conflictValues.has(v)) return cell;
          return { ...cell, status: "confirmed" as const };
        }),
      })));
      if (Object.keys(nonConflictGetDict).length > 0) {
        s.setTotalGetDict(prev => mergeGetDict(prev, nonConflictGetDict));
      }

      s.setPhase("janken");
      s.setShowConflictResolve(true);
      addLog("再指名で重複を検出。勝者選択へ", "warn");
    } else {
      const currentGetDict: Record<string, Array<string | number>> = {};
      for (const row of s.tableState) {
        currentGetDict[row.block] = row.cells
          .filter((c) => c.value.trim() && c.status !== "span")
          .map((c) => c.value.trim());
      }
      s.setTotalGetDict((prev) => mergeGetDict(prev, currentGetDict));
      s.setRenominationState(null);
      s.setPhase("confirmed");
      s.setDraftProgress((prev) => ({ ...prev, phase: "confirmed" }));
      addLog("再指名を確定しました", "info");
    }
  }, [
    s.renominationDuplicates, s.tableState, s.totalGetDict, s.renominationInput,
    s.rookies, s.draftProgress.category, addLog,
    s.setPhase, s.setShowConflictResolve, s.setTotalGetDict,
    s.setRenominationState, s.setDraftProgress, s.setTableState,
  ]);

  const handlePhaseAction = useCallback(() => {
    if (s.renominationState) {
      handleConfirmRenomination();
    } else {
      handleConfirmNominations();
    }
  }, [s.renominationState, handleConfirmRenomination, handleConfirmNominations]);

  const handleNextRound = useCallback(() => {
    const nextRound = s.draftProgress.round + 1;
    if (nextRound > s.draftProgress.maxRound) {
      const nextCat = getNextCategory(s.draftProgress.category);
      if (!nextCat) {
        s.setShowFinalResult(true);
      }
      return;
    }

    apiPost("/next_round", { round: nextRound });

    const cat = s.draftProgress.category;
    const blockSlotsForCat: Record<string, number[]> = {};
    for (const block of Object.keys(s.activeBlockSlots)) {
      blockSlotsForCat[block] = getBlockCategorySlots(s.activeBlockSlots, block, cat);
    }

    let newTable = rebuildTableFromGetDict(s.tableState, s.totalGetDict);
    newTable = applyRoundSlots(newTable, blockSlotsForCat, nextRound);

    s.setTableState(newTable);
    const newProgress: DraftProgress = {
      ...s.draftProgress,
      round: nextRound,
      phase: "picking",
    };
    s.setDraftProgress(newProgress);
    s.setPhase("picking");
    s.setRenominationState(null);
    addLog(`第${nextRound}巡を開始`, "info");
  }, [
    s.draftProgress, s.tableState, s.totalGetDict, s.activeBlockSlots, addLog,
    s.setShowFinalResult, s.setTableState, s.setDraftProgress, s.setPhase, s.setRenominationState,
  ]);

  const handleNextCategory = useCallback(() => {
    const nextCat = getNextCategory(s.draftProgress.category);
    if (!nextCat) {
      s.setShowFinalResult(true);
      addLog("全カテゴリ完了！", "info");
      return;
    }

    if (Object.keys(s.totalGetDict).length > 0) {
      s.setAllCategoryResults((prev) => ({
        ...prev,
        [s.draftProgress.category]: s.totalGetDict,
      }));
    }

    apiPost("/next_category", { category: nextCat });

    const table = buildTable(s.activeBlockSlots, nextCat, 1);
    s.setTableState(table);
    const newProgress: DraftProgress = {
      category: nextCat,
      round: 1,
      maxRound: s.draftProgress.maxRound,
      phase: "picking",
    };
    s.setDraftProgress(newProgress);
    s.setPhase("picking");
    s.setTotalGetDict({});
    s.setRenominationState(null);
    addLog(`${CATEGORY_LABELS[nextCat]}ドラフトを開始`, "info");
  }, [
    s.draftProgress, s.activeBlockSlots, buildTable, addLog, s.totalGetDict,
    s.setShowFinalResult, s.setAllCategoryResults, s.setTableState,
    s.setDraftProgress, s.setPhase, s.setTotalGetDict, s.setRenominationState,
  ]);

  const handleSaveState = useCallback(() => {
    const backup: DraftBackup = {
      savedAt: new Date().toISOString(),
      round: s.draftProgress.round,
      category: s.draftProgress.category,
      tableData: s.tableState.map((row) => ({
        block: row.block,
        cells: row.cells.map((c) => ({
          cycle: c.cycle,
          index: c.index,
          value: c.value,
          status: c.status,
        })),
      })),
      totalGetDict: s.totalGetDict,
      draftProgress: { ...s.draftProgress },
    };
    s.saveBackup(backup);
    s.saveToLocalStorage(backup);
    addLog("状態を保存しました", "info");
  }, [s.draftProgress, s.tableState, s.totalGetDict, s.saveBackup, s.saveToLocalStorage, addLog]);

  const handleRestoreState = useCallback(() => {
    const backup = s.restoreBackup() || s.restoreFromLocalStorage();
    if (!backup) return;
    s.setDraftProgress(backup.draftProgress as DraftProgress);
    s.setTableState(
      backup.tableData.map((row) => ({
        block: row.block,
        cells: row.cells.map((c) => ({ ...c })),
      }))
    );
    s.setTotalGetDict(backup.totalGetDict);
    s.setPhase((backup.draftProgress.phase as DraftPhase) || "picking");
    addLog("状態を復元しました", "info");
  }, [s.restoreBackup, s.restoreFromLocalStorage, addLog, s.setDraftProgress, s.setTableState, s.setTotalGetDict, s.setPhase]);

  const handleCellKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, block: string, cellIndex: number) => {
      const row = s.tableState.find((r) => r.block === block);
      if (!row) return;

      const editableIndices = row.cells
        .map((c, i) => (c.status === "editable" ? i : -1))
        .filter((i) => i >= 0);
      const posInEditable = editableIndices.indexOf(cellIndex);

      if (e.key === "ArrowRight" || e.key === "Tab") {
        e.preventDefault();
        if (posInEditable < editableIndices.length - 1) {
          s.setFocusedCell({ block, cellIndex: editableIndices[posInEditable + 1] });
        } else {
          const blockIndex = s.tableState.findIndex((r) => r.block === block);
          for (let bi = blockIndex + 1; bi < s.tableState.length; bi++) {
            const nextEditable = s.tableState[bi].cells.findIndex(
              (c) => c.status === "editable"
            );
            if (nextEditable >= 0) {
              s.setFocusedCell({ block: s.tableState[bi].block, cellIndex: nextEditable });
              break;
            }
          }
        }
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (posInEditable > 0) {
          s.setFocusedCell({ block, cellIndex: editableIndices[posInEditable - 1] });
        } else {
          const blockIndex = s.tableState.findIndex((r) => r.block === block);
          for (let bi = blockIndex - 1; bi >= 0; bi--) {
            const prevRow = s.tableState[bi];
            const prevEditables = prevRow.cells
              .map((c, i) => (c.status === "editable" ? i : -1))
              .filter((i) => i >= 0);
            if (prevEditables.length > 0) {
              s.setFocusedCell({
                block: prevRow.block,
                cellIndex: prevEditables[prevEditables.length - 1],
              });
              break;
            }
          }
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        const blockIndex = s.tableState.findIndex((r) => r.block === block);
        for (let bi = blockIndex + 1; bi < s.tableState.length; bi++) {
          const nextRow = s.tableState[bi];
          if (cellIndex < nextRow.cells.length && nextRow.cells[cellIndex].status === "editable") {
            s.setFocusedCell({ block: nextRow.block, cellIndex });
            break;
          }
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const blockIndex = s.tableState.findIndex((r) => r.block === block);
        for (let bi = blockIndex - 1; bi >= 0; bi--) {
          const prevRow = s.tableState[bi];
          if (cellIndex < prevRow.cells.length && prevRow.cells[cellIndex].status === "editable") {
            s.setFocusedCell({ block: prevRow.block, cellIndex });
            break;
          }
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        const blockIndex = s.tableState.findIndex((r) => r.block === block);
        for (let bi = blockIndex + 1; bi < s.tableState.length; bi++) {
          const nextRow = s.tableState[bi];
          if (cellIndex < nextRow.cells.length && nextRow.cells[cellIndex].status === "editable") {
            s.setFocusedCell({ block: nextRow.block, cellIndex });
            return;
          }
        }
        if (posInEditable < editableIndices.length - 1) {
          s.setFocusedCell({ block, cellIndex: editableIndices[posInEditable + 1] });
        }
      }
    },
    [s.tableState, s.setFocusedCell]
  );

  const handleQuickSet = useCallback(async () => {
    try {
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
      s.setRookies(allRookies);

      const slotsRes = await fetch("/devdata/block_slots.csv");
      const slotsText = (await slotsRes.text()).replace(/^\uFEFF/, "");
      const { config, maxRound } = parseBlockSlotsCsv(slotsText);

      s.setActiveBlockSlots(config);
      const progress: DraftProgress = { ...s.draftProgress, maxRound };
      s.setDraftProgress(progress);
      const table = buildTable(config, progress.category, progress.round);
      s.setTableState(table);
      addLog(`デフォルトデータをセットしました（${allRookies.length}名）`, "info");
    } catch (err) {
      console.error("Quick set failed:", err);
      addLog("データセット失敗", "error");
    }
  }, [
    s.draftProgress, buildTable, addLog,
    s.setRookies, s.setActiveBlockSlots, s.setDraftProgress, s.setTableState,
  ]);

  return {
    addLog, setCellValue, buildTable, handleRookiesImport, handleBlockSlotsImport,
    exportToJSON, getRookieName, handleCategoryTabClick, handleConfirmNominations,
    handleConflictResolve, handleConflictResolveClose, handleConfirmRenomination,
    handlePhaseAction, handleNextRound, handleNextCategory, handleSaveState,
    handleRestoreState, handleCellKeyDown, handleQuickSet,
  };
}
