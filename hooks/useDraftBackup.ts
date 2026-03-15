import { useRef, useState, useEffect, useCallback } from "react"
import type { DraftProgress } from "@/types/draft-progress"

export type DraftBackup = {
  savedAt: string;
  round: number;
  category: string;
  tableData: Array<{
    block: string;
    cells: Array<{
      cycle: "1st" | "2nd";
      index: number;
      value: string;
      status: "editable" | "span" | "confirmed" | "unused";
    }>;
  }>;
  totalGetDict: Record<string, Array<string | number>>;
  draftProgress: {
    category: string;
    round: number;
    maxRound: number;
    phase: string;
  };
}

const STORAGE_KEY = "kumano-draft-backup";

export function useDraftBackup() {
  const memoryRef = useRef<DraftBackup | null>(null)
  const [hasBackup, setHasBackup] = useState(false)
  const [hasLocalStorageBackup, setHasLocalStorageBackup] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      setHasLocalStorageBackup(stored !== null);
    } catch { /* ignore */ }
  }, [])

  const saveBackup = useCallback((data: DraftBackup) => {
    memoryRef.current = data;
    setHasBackup(true);
  }, [])

  const restoreBackup = useCallback((): DraftBackup | null => {
    return memoryRef.current;
  }, [])

  const saveToLocalStorage = useCallback((data: DraftBackup) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      setHasLocalStorageBackup(true);
    } catch (err) {
      console.warn("localStorage save failed:", err);
    }
  }, [])

  const restoreFromLocalStorage = useCallback((): DraftBackup | null => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, [])

  return {
    saveBackup,
    restoreBackup,
    hasBackup,
    saveToLocalStorage,
    restoreFromLocalStorage,
    hasLocalStorageBackup,
  }
}
