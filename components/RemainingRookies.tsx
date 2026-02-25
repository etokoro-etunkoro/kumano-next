"use client";

import { useState } from "react";
import { RookieCategory } from "@/types/rookie";

type RemainingRookiesProps = {
  rookies: Array<{ id: number; name?: string; category: RookieCategory }>;
  getDict: Record<string, Array<string | number>>;
  category?: RookieCategory;
};

export default function RemainingRookies({ rookies, getDict, category }: RemainingRookiesProps) {
  const [filter, setFilter] = useState<"all" | "remaining" | "selected">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const selectedIds = new Set(Object.values(getDict).flat().map(String));

  // Reverse lookup: rookie id -> block name
  const idToBlock = new Map<string, string>();
  for (const [blockName, ids] of Object.entries(getDict)) {
    for (const id of ids) {
      idToBlock.set(String(id), blockName);
    }
  }

  // Category filter: if category prop is provided, show only that category
  const categoryFiltered = category
    ? rookies.filter((r) => r.category === category)
    : rookies;

  const filtered = categoryFiltered.filter((rookie) => {
    const isSelected = selectedIds.has(String(rookie.id));
    if (filter === "remaining" && isSelected) return false;
    if (filter === "selected" && !isSelected) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchId = String(rookie.id).includes(q);
      const matchName = rookie.name?.toLowerCase().includes(q) ?? false;
      if (!matchId && !matchName) return false;
    }
    return true;
  });

  const totalCount = categoryFiltered.length;
  const selectedCount = categoryFiltered.filter((r) => selectedIds.has(String(r.id))).length;
  const remainingCount = totalCount - selectedCount;

  return (
    <div className="remaining-rookies">
      <div className="remaining-header">
        <h2 className="remaining-title">残り新入寮生一覧</h2>
        <div className="remaining-stats">
          <span className="stat-item stat-remaining">残り{remainingCount}名</span>
          <span className="stat-item stat-selected">選択済{selectedCount}名</span>
          <span className="stat-item stat-total">全{totalCount}名</span>
        </div>
      </div>

      <div className="remaining-controls">
        <div className="filter-group">
          {(["all", "remaining", "selected"] as const).map((value) => (
            <label key={value} className="filter-option">
              <input
                type="radio"
                name="rookieFilter"
                value={value}
                checked={filter === value}
                onChange={() => setFilter(value)}
              />
              {value === "all" ? "全員" : value === "remaining" ? "残り" : "選択済"}
            </label>
          ))}
        </div>
        <div className="search-box">
          <input
            className="search-input"
            type="text"
            placeholder="番号・氏名で検索"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="search-clear" onClick={() => setSearchQuery("")}>
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="rookies-list">
        {filtered.length > 0 ? (
          <table className="rookies-table">
            <thead>
              <tr>
                <th>番号</th>
                <th>氏名</th>
                <th>状態</th>
                <th>取得ブロック</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((rookie) => {
                const isSelected = selectedIds.has(String(rookie.id));
                const blockName = idToBlock.get(String(rookie.id)) || "-";
                return (
                  <tr
                    key={rookie.id}
                    className={"rookie-row " + (isSelected ? "rookie-selected" : "rookie-remaining")}
                  >
                    <td className="rookie-id">{rookie.id}</td>
                    <td className="rookie-name">{rookie.name || "-"}</td>
                    <td className={"rookie-status " + (isSelected ? "status-selected" : "status-remaining")}>
                      {isSelected ? "選択済" : "残り"}
                    </td>
                    <td className="rookie-block">{blockName}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="no-results">該当する新入寮生はいません</div>
        )}
      </div>

      <div className="remaining-footer">
        表示: {filtered.length}名 / 全{totalCount}名
      </div>
    </div>
  );
}
