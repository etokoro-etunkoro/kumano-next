"use client";

import React from "react";
import type { DraftPhase } from "@/types/draft-progress";
import type { Row } from "@/utils/draftTableUtils";

type DraftTableProps = {
  tableState: Row[];
  maxCells: number;
  phase: DraftPhase;
  duplicateColorMap: Record<string, string>;
  cellWarnings: Record<string, Record<number, string>>;
  tableRef: React.RefObject<HTMLTableElement | null>;
  setCellValue: (block: string, cellIndex: number, value: string) => void;
  handleCellKeyDown: (e: React.KeyboardEvent<HTMLInputElement>, block: string, cellIndex: number) => void;
  getRookieName: (num: string) => string | null;
};

export default function DraftTable({
  tableState, maxCells, phase, duplicateColorMap, cellWarnings, tableRef,
  setCellValue, handleCellKeyDown, getRookieName,
}: DraftTableProps) {
  return (
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
            <td style={{ fontWeight: 600, whiteSpace: "nowrap", fontSize: 28 }}>{row.block}</td>
            {row.cells.map((cell, ci) => {
              const v = cell.value.trim();
              const dupColor = v ? duplicateColorMap[v] : undefined;
              const warning = cellWarnings[row.block]?.[ci];
              const isConfirmed = cell.status === "confirmed";
              const isEditable = cell.status === "editable";
              const isSpan = cell.status === "span";

              return (
                <td
                  key={ci}
                  className={`${isConfirmed ? "cell-black" : isEditable ? "cell-red" : ""} ${isSpan ? "cell-span" : ""} ${dupColor ? "cell-duplicate" : ""} ${warning && !dupColor ? "cell-warning" : ""}`}
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
                      {warning && !dupColor && (
                        <div style={{ fontSize: 18, color: '#ef4444', marginTop: 2 }}>{warning}</div>
                      )}
                      {(() => {
                        const name = getRookieName(cell.value.trim());
                        return name ? (
                          <div style={{ fontSize: 20, color: "#666", marginTop: 2 }}>
                            {name}
                          </div>
                        ) : null;
                      })()}
                    </div>
                  ) : isEditable && phase === "confirmed" ? (
                    <span style={{ fontSize: 32 }}>
                      {cell.value.trim()
                        ? `${cell.value.trim()}${(() => {
                            const name = getRookieName(cell.value.trim());
                            return name ? ` ${name}` : "";
                          })()}`
                        : ""}
                    </span>
                  ) : isConfirmed ? (
                    <span style={{ fontSize: 32 }}>
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
            {row.cells.length < maxCells &&
              Array.from({ length: maxCells - row.cells.length }, (_, i) => (
                <td key={`pad-${i}`}>&nbsp;</td>
              ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
