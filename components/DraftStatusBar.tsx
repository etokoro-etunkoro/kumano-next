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
  onCsvExport: () => void;
  hasConflicts: boolean;
  allConflictsResolved: boolean;
  disabled: boolean;
  isLocked: boolean;
};

export default function DraftStatusBar({
  progress,
  onConfirm,
  onNextRound,
  onCsvExport,
  hasConflicts,
  allConflictsResolved,
  disabled,
  isLocked,
}: DraftStatusBarProps) {
  const { category, round, maxRound, phase } = progress;

  const actionStyle: React.CSSProperties = {
    margin: 0,
    padding: "18px 40px",
    background: "#fbbf24",
    border: "2px solid #d97706",
    borderRadius: "10px",
    cursor: "pointer",
    fontSize: 22,
    fontWeight: 700,
  };
  const disabledStyle: React.CSSProperties = {
    ...actionStyle,
    opacity: 0.45,
    cursor: "not-allowed",
  };

  const renderActionButton = () => {
    if (isLocked) {
      return <span style={{ fontSize: 22, fontWeight: 700, color: "#fbbf24" }}>ドラフト完了</span>;
    }

    switch (phase) {
      case "picking":
        return (
          <button
            type="button"
            style={disabled ? disabledStyle : actionStyle}
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
            style={!allConflictsResolved ? disabledStyle : actionStyle}
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
              style={actionStyle}
              onClick={onNextRound}
            >
              次のラウンドへ
            </button>
          );
        }
        return (
          <button
            type="button"
            style={actionStyle}
            onClick={onCsvExport}
          >
            CSV出力
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
          font-size: 20px;
          font-weight: 700;
        }
        .actions {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
        }
      `}</style>
    </div>
  );
}
