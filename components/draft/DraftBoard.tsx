"use client";

import React, { useEffect } from "react";
import { isDraftComplete, CATEGORY_ORDER, CATEGORY_LABELS } from "@/types/draft-progress";

import DraftLog from "../DraftLog";
import DraftStatusBar from "../DraftStatusBar";
import CsvImporter from "../CsvImporter";
import FinalResultModal from "../FinalResultModal";
import ConflictResolveModal from "../ConflictResolveModal";
import RemainingRookies from "../RemainingRookies";
import DraftTable from "./DraftTable";
import { useDraftState } from "./useDraftState";
import { useDraftActions } from "./DraftActions";

export default function DraftBoard({ initial }: { initial: unknown }) {
  const s = useDraftState();
  const a = useDraftActions(s);

  // フォーカス制御
  useEffect(() => {
    if (!s.focusedCell || !s.tableRef.current) return;
    const input = s.tableRef.current.querySelector(
      `input[data-block="${s.focusedCell.block}"][data-cell="${s.focusedCell.cellIndex}"]`
    ) as HTMLInputElement | null;
    if (input) {
      input.focus();
      input.select();
    }
  }, [s.focusedCell, s.tableRef]);

  const isComplete = isDraftComplete(s.draftProgress) && s.phase === "confirmed";
  const maxCells = s.tableState.reduce((max, row) => Math.max(max, row.cells.length), 0);

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
            onClick={a.handleQuickSet}
          >
            開発用: デフォルトデータをセット
          </button>
        )}
        <CsvImporter
          onRookiesImport={a.handleRookiesImport}
          onBlockSlotsImport={a.handleBlockSlotsImport}
        />
      </div>

      {/* 操作ガイド（データ未読込時のみ） */}
      {s.tableState.length === 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 8px', color: 'var(--text)' }}>操作手順</h3>
          <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6, margin: 0 }}>
            ① CSVまたはクイックセットでデータを読み込む → ② 各ブロックの枠に番号を入力 → ③ 指名終了ボタンで確定
          </p>
        </div>
      )}

      {/* ステータスバー */}
      <DraftStatusBar
        progress={s.draftProgress}
        onConfirm={a.handlePhaseAction}
        onNextRound={a.handleNextRound}
        onNextCategory={a.handleNextCategory}
        hasConflicts={s.conflictInfo.length > 0}
        allConflictsResolved={s.allConflictsResolved}
        disabled={s.phase === "confirmed" || s.tableState.length === 0}
        onSaveState={a.handleSaveState}
        onRestoreState={a.handleRestoreState}
        hasSavedState={s.hasBackup || s.hasLocalStorageBackup}
        isLocked={isComplete || s.showFinalResult}
      />

      {/* 2カラムレイアウト */}
      <div className="two-column-layout">
        <div className="main-column">
          {/* 再指名フェーズバナー */}
          {s.renominationState && (
            <div className="renomination-banner">
              再指名フェーズ: {s.renominationState.pendingBlocks.join(', ')} は敗者です。空き枠に別の番号を入力してください。
            </div>
          )}

          {/* カテゴリタブ */}
          {s.tableState.length > 0 && (
            <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
              {CATEGORY_ORDER.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => a.handleCategoryTabClick(cat)}
                  style={{
                    padding: "8px 20px",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    cursor: "pointer",
                    fontWeight: cat === s.draftProgress.category ? 700 : 400,
                    background:
                      cat === s.draftProgress.category
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
          {s.tableState.length > 0 && (
            <div className="card" style={{ overflowX: "auto", marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 8px' }}>指名テーブル</h3>
              <DraftTable
                tableState={s.tableState}
                maxCells={maxCells}
                phase={s.phase}
                duplicateColorMap={s.duplicateColorMap}
                cellWarnings={s.cellWarnings}
                tableRef={s.tableRef}
                setCellValue={a.setCellValue}
                handleCellKeyDown={a.handleCellKeyDown}
                getRookieName={a.getRookieName}
              />
            </div>
          )}

          {/* 競合サマリー */}
          {s.conflictInfo.length > 0 && s.phase !== "confirmed" && (
            <div className="conflict-summary">
              <p className="conflict-title">重複指名あり</p>
              <ul className="conflict-list">
                {s.conflictInfo.map((c) => (
                  <li key={c.value} className="conflict-item">
                    <span
                      className="conflict-number"
                      style={{ backgroundColor: s.duplicateColorMap[c.value] }}
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
          {s.rookies.length > 0 && (
            <RemainingRookies
              rookies={s.rookies.map((r) => ({ id: r.id, name: r.name, category: r.category }))}
              getDict={s.totalGetDict}
              category={s.draftProgress.category}
            />
          )}

          {/* ドラフトログ */}
          <DraftLog entries={s.logEntries} />
        </div>
      </div>

      {/* 競合解決モーダル */}
      {s.showConflictResolve && (
        <ConflictResolveModal
          conflicts={
            s.renominationDuplicates.length > 0
              ? s.renominationDuplicates.map((d) => ({ val: d.value, blocks: d.blocks }))
              : s.conflictInfo.map((c) => ({ val: c.value, blocks: c.blocks }))
          }
          onResolve={a.handleConflictResolve}
          onClose={a.handleConflictResolveClose}
        />
      )}

      {/* 最終結果モーダル */}
      <FinalResultModal
        isOpen={s.showFinalResult}
        onClose={() => s.setShowFinalResult(false)}
        totalGetDict={s.combinedGetDict}
        rookies={s.rookies}
      />
    </div>
  );
}
