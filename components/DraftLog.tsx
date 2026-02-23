"use client";

import React, { useState, useEffect, useRef } from "react";

export type LogEntry = {
  timestamp: string;
  message: string;
  type: "info" | "warn" | "error" | "winner";
};

type DraftLogProps = {
  entries: LogEntry[];
};

const TYPE_CONFIG: Record<LogEntry["type"], { icon: string; color: string }> = {
  info:   { icon: "\u2139\uFE0F", color: "#374151" },
  warn:   { icon: "\u26A0\uFE0F", color: "#92400e" },
  error:  { icon: "\u274C",       color: "#991b1b" },
  winner: { icon: "\uD83C\uDFC6", color: "#065f46" },
};

export default function DraftLog({ entries }: DraftLogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [entries.length, isOpen]);

  return (
    <div className="log-container">
      <div
        className="log-header"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <span>{"\uD83D\uDCCB"} ログ ({entries.length}件)</span>
        <span>{isOpen ? "\u25B2" : "\u25BC"}</span>
      </div>

      {isOpen && (
        <div className="log-list" ref={listRef}>
          {entries.map((entry, i) => {
            const cfg = TYPE_CONFIG[entry.type];
            return (
              <div key={i} className="log-entry" style={{ color: cfg.color }}>
                [{entry.timestamp}] {cfg.icon} {entry.message}
              </div>
            );
          })}
        </div>
      )}

      <style jsx>{`
        .log-container {
          margin-top: 16px;
          border: 1px solid var(--border);
          border-radius: 8px;
          overflow: hidden;
        }

        .log-header {
          background: #f1f5f9;
          padding: 8px 12px;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 14px;
          font-weight: 600;
          color: #334155;
          user-select: none;
        }

        .log-header:hover {
          background: #e2e8f0;
        }

        .log-list {
          max-height: 300px;
          overflow-y: auto;
          padding: 8px;
          font-size: 13px;
          font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;
        }

        .log-entry {
          padding: 2px 0;
          line-height: 1.5;
          white-space: pre-wrap;
          word-break: break-word;
        }
      `}</style>
    </div>
  );
}
