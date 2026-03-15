"use client";

import { useState } from "react";

type ConflictResolveModalProps = {
  conflicts: Array<{ val: string; blocks: string[] }>;
  onResolve: (winners: Record<string, string>) => void;
  onClose: () => void;
};

export default function ConflictResolveModal({
  conflicts,
  onResolve,
  onClose,
}: ConflictResolveModalProps) {
  const [winners, setWinners] = useState<Record<string, string>>({});

  if (conflicts.length === 0) return null;

  const allDecided = conflicts.every((c) => winners[c.val] !== undefined);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: 16,
          padding: 32,
          maxWidth: 700,
          width: "90%",
          maxHeight: "80vh",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            fontSize: 26,
            fontWeight: "bold",
            marginBottom: 20,
          }}
        >
          勝者を選択してください
        </div>

        {conflicts.map((conflict) => (
          <div key={conflict.val}>
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                marginBottom: 10,
              }}
            >
              No.{conflict.val} の勝者:
            </div>
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                marginBottom: 16,
              }}
            >
              {conflict.blocks.map((blockName) => {
                const isSelected = winners[conflict.val] === blockName;
                const otherSelected =
                  winners[conflict.val] !== undefined && !isSelected;

                return (
                  <button
                    key={blockName}
                    type="button"
                    style={{
                      padding: "14px 28px",
                      borderRadius: 10,
                      cursor: "pointer",
                      fontSize: 20,
                      fontWeight: 600,
                      border: "2px solid",
                      background: isSelected ? "#3b82f6" : "#f1f5f9",
                      color: isSelected ? "white" : "#334155",
                      borderColor: isSelected ? "#2563eb" : "#e2e8f0",
                      opacity: otherSelected ? 0.6 : 1,
                    }}
                    onClick={() =>
                      setWinners((prev) => ({
                        ...prev,
                        [conflict.val]: blockName,
                      }))
                    }
                  >
                    {blockName}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <div
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "flex-end",
            marginTop: 16,
            paddingTop: 16,
            borderTop: "1px solid #e5e7eb",
          }}
        >
          <button
            type="button"
            disabled={!allDecided}
            style={{
              padding: "14px 32px",
              borderRadius: 10,
              cursor: allDecided ? "pointer" : "not-allowed",
              fontSize: 20,
              fontWeight: 700,
              border: "none",
              background: allDecided ? "#10b981" : "#9ca3af",
              color: "white",
            }}
            onClick={() => onResolve(winners)}
          >
            確定
          </button>
          <button
            type="button"
            style={{
              padding: "14px 32px",
              borderRadius: 10,
              cursor: "pointer",
              fontSize: 20,
              fontWeight: 700,
              border: "none",
              background: "#6b7280",
              color: "white",
            }}
            onClick={onClose}
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}
