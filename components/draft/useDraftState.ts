"use client";

import { useState, useMemo, useRef } from "react";

import type { Rookie } from "@/types/rookie";
import type { DraftProgress, DraftPhase } from "@/types/draft-progress";
import { createInitialProgress } from "@/types/draft-progress";
import type { BlockSlotsConfig } from "@/types/block-slots";
import type { Row } from "@/utils/draftTableUtils";
import type { LogEntry } from "../DraftLog";
import { useDraftBackup } from "@/hooks/useDraftBackup";
import { DUPLICATE_COLOR_PALETTE } from "./constants";
import type { RenominationState, RenominationInput } from "./types";

export function useDraftState() {
  // ═══════════ useState群 ═══════════
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

  // ═══════════ useDraftBackup ═══════════
  const {
    saveBackup,
    restoreBackup,
    hasBackup,
    saveToLocalStorage,
    restoreFromLocalStorage,
    hasLocalStorageBackup,
  } = useDraftBackup();

  // ═══════════ useMemo群 ═══════════

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

  const duplicateColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    conflictInfo.forEach((c, i) => {
      map[c.value] = DUPLICATE_COLOR_PALETTE[i % DUPLICATE_COLOR_PALETTE.length];
    });
    return map;
  }, [conflictInfo]);

  const renominationDuplicates = useMemo(() => {
    if (!renominationState) return [];
    const valueToBlocks: Record<string, string[]> = {};

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

  const allConflictsResolved = useMemo(() => {
    return phase !== "janken";
  }, [phase]);

  const combinedGetDict = useMemo(() => {
    const combined: Record<string, Array<string | number>> = {};
    for (const catResult of Object.values(allCategoryResults)) {
      for (const [block, nums] of Object.entries(catResult)) {
        if (!combined[block]) combined[block] = [];
        for (const n of nums) {
          if (!combined[block].includes(n)) combined[block].push(n);
        }
      }
    }
    for (const [block, nums] of Object.entries(totalGetDict)) {
      if (!combined[block]) combined[block] = [];
      for (const n of nums) {
        if (!combined[block].includes(n)) combined[block].push(n);
      }
    }
    for (const block of Object.keys(combined)) {
      combined[block].sort((a, b) => Number(a) - Number(b));
    }
    return combined;
  }, [allCategoryResults, totalGetDict]);

  return {
    rookies, setRookies,
    draftProgress, setDraftProgress,
    tableState, setTableState,
    phase, setPhase,
    totalGetDict, setTotalGetDict,
    allCategoryResults, setAllCategoryResults,
    activeBlockSlots, setActiveBlockSlots,
    showConflictResolve, setShowConflictResolve,
    renominationState, setRenominationState,
    renominationInput, setRenominationInput,
    showFinalResult, setShowFinalResult,
    logEntries, setLogEntries,
    focusedCell, setFocusedCell,
    tableRef,
    saveBackup, restoreBackup, hasBackup,
    saveToLocalStorage, restoreFromLocalStorage, hasLocalStorageBackup,
    conflictInfo, duplicateColorMap, renominationDuplicates,
    allConflictsResolved, combinedGetDict,
  };
}
