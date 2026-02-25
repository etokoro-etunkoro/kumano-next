"use client";

import React from "react";
import {
  DraftProgress,
  CATEGORY_LABELS,
  PHASE_LABELS,
} from "@/types/draft-progress";

type DraftStatusBarProps = {
  progress: DraftProgress;
  onConfirm: () => void;
  onNextRound: () => void;
  onNextCategory: () => void;
  hasConflicts: boolean;
  allConflictsResolved: boolean;
  disabled: boolean;
  onSaveState: () => void;
  onRestoreState: () => void;
  hasSavedState: boolean;
  isLocked: boolean;
};

export default function DraftStatusBar({
  progress,
  onConfirm,
  onNextRound,
  onNextCategory,
  hasConflicts,
  allConflictsResolved,
  disabled,
  onSaveState,
  onRestoreState,
  hasSavedState,
  isLocked,
}: DraftStatusBarProps) {
  const { category, round, maxRound, phase } = progress;

  const renderActionButton = () => {
    if (isLocked) {
      return <span className="status-done">ドラフト完了</span>;
    }

    switch (phase) {
      case "picking":
        return (
          <button
            type="button"
            className="action-btn"
            disabled={disabled}
            onClick={onConfirm}
          >
            指名終了
          </button>
        );
      case "janken":
        return (
          <button
            type="button"
            className="action-btn"
            disabled={!allConflictsResolved}
            onClick={onConfirm}
          >
            ジャンケン完了
          </button>
        );
      case "confirmed":
        if (round < maxRound) {
          return (
            <button
              type="button"
              className="action-btn"
              onClick={onNextRound}
            >
              次のラウンドへ
            </button>
          );
        }
        return (
          <button
            type="button"
            className="action-btn"
            onClick={onNextCategory}
          >
            次のカテゴリへ
          </button>
        );
      default:
        return null;
    }
  };

  return (
    <div className="status-bar">
      <span className="status-text">
        {CATEGORY_LABELS[category]} 第{round}巡 / 全{maxRound}巡 —{" "}
        {PHASE_LABELS[phase]}
      </span>

      <div className="actions">
        {renderActionButton()}

        <button type="button" className="util-btn" onClick={onSaveState}>
          💾 状態保存
        </button>
        <button
          type="button"
          className="util-btn"
          disabled={!hasSavedState}
          onClick={onRestoreState}
        >
          ↩ やり直し
        </button>
      </div>

      <style jsx>{`
        .status-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
          padding: 14px 20px;
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
          margin-bottom: 16px;
        }
        .status-text {
          font-size: 15px;
          font-weight: 600;
        }
        .actions {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
        }
        .action-btn {
          cursor: pointer;
          border: 1px solid rgba(120, 170, 255, 0.35);
          background: linear-gradient(
            180deg,
            rgba(120, 170, 255, 0.35),
            rgba(120, 170, 255, 0.18)
          );
          color: var(--text);
          padding: 10px 20px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
        }
        .action-btn:hover:not(:disabled) {
          filter: brightness(1.08);
        }
        .action-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        .util-btn {
          cursor: pointer;
          border: 1px solid var(--border);
          background: var(--panel2);
          color: var(--text);
          padding: 10px 16px;
          border-radius: 12px;
          font-size: 13px;
        }
        .util-btn:hover:not(:disabled) {
          filter: brightness(1.08);
        }
        .util-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        .status-done {
          font-size: 14px;
          font-weight: 600;
          color: #fbbf24;
        }
      `}</style>
    </div>
  );
}
