"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import type { Rookie, RookieCategory } from "@/types/rookie";
import type { BlockSlotsConfig } from "@/types/block-slots";
import { parseBlockSlotsCsv } from "@/utils/csvParser";

type CsvImporterProps = {
  onRookiesImport: (rookies: Rookie[]) => void;
  onBlockSlotsImport: (config: BlockSlotsConfig, maxRound: number) => void;
};

const CATEGORY_CSV_CONFIG: Array<{
  category: RookieCategory;
  label: string;
}> = [
  { category: "freshman", label: "新入生CSV" },
  { category: "upperclassman", label: "上回生CSV" },
  { category: "temporary", label: "臨時CSV" },
];

const SHEET_CATEGORY_MAP: Record<string, RookieCategory> = {
  "新入生": "freshman",
  "上回生": "upperclassman",
  "臨時": "temporary",
};

export default function CsvImporter({
  onRookiesImport,
  onBlockSlotsImport,
}: CsvImporterProps) {
  const [rookieCounts, setRookieCounts] = useState<Record<RookieCategory, number | null>>({
    freshman: null,
    upperclassman: null,
    temporary: null,
  });
  const [blockCount, setBlockCount] = useState<number | null>(null);
  const [excelResult, setExcelResult] = useState<string | null>(null);

  function handleExcelImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = new Uint8Array(ev.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: "array" });

      const results: string[] = [];

      // 枠数設定シート
      if (wb.SheetNames.includes("枠数設定")) {
        const ws = wb.Sheets["枠数設定"];
        const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
        const csvLines = rows
          .slice(1) // ヘッダー行をスキップ
          .filter((r) => r.length >= 4 && r[0])
          .map((r) => r.join(","));
        if (csvLines.length > 0) {
          const text = csvLines.join("\n");
          const { config, maxRound, blockCount: count } = parseBlockSlotsCsv(text);
          setBlockCount(count);
          onBlockSlotsImport(config, maxRound);
          results.push(`枠数: ${count}ブロック`);
        }
      }

      // 寮生シート
      for (const [sheetName, category] of Object.entries(SHEET_CATEGORY_MAP)) {
        if (!wb.SheetNames.includes(sheetName)) continue;
        const ws = wb.Sheets[sheetName];
        const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
        const rookies: Rookie[] = [];
        for (const row of rows.slice(1)) { // ヘッダー行をスキップ
          const num = Number(row[0]);
          if (isNaN(num) || num === 0) continue;
          rookies.push({
            id: num,
            name: String(row[1] ?? "").trim(),
            category,
            remaining: true,
          });
        }
        if (rookies.length > 0) {
          setRookieCounts((prev) => ({ ...prev, [category]: rookies.length }));
          onRookiesImport(rookies);
          results.push(`${sheetName}: ${rookies.length}名`);
        }
      }

      if (results.length > 0) {
        setExcelResult(results.join(" / "));
      } else {
        setExcelResult("対応するシートが見つかりませんでした");
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function handleRookieCsv(category: RookieCategory, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = (ev.target?.result as string).replace(/^\uFEFF/, "");
      const rookies: Rookie[] = [];

      for (const line of text.split("\n")) {
        const parts = line.trim().split(",");
        const num = parseInt(parts[0], 10);
        if (isNaN(num)) continue;
        rookies.push({
          id: num,
          name: parts[1]?.trim() || "",
          category,
          remaining: true,
        });
      }

      setRookieCounts((prev) => ({ ...prev, [category]: rookies.length }));
      onRookiesImport(rookies);
    };
    reader.readAsText(file);
  }

  function handleBlockSlotsCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = (ev.target?.result as string).replace(/^\uFEFF/, "");
      const { config, maxRound, blockCount: count } = parseBlockSlotsCsv(text);
      setBlockCount(count);
      onBlockSlotsImport(config, maxRound);
    };
    reader.readAsText(file);
  }

  return (
    <div className="csv-importer">
      <div className="excel-section">
        <div className="excel-header">Excelで一括インポート</div>
        <div className="csv-row">
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleExcelImport}
          />
          {excelResult && (
            <span className="csv-result">{excelResult}</span>
          )}
        </div>
        <div className="excel-meta">
          <a href="/template/kumano_draft_template.xlsx" download className="template-link">
            テンプレートをダウンロード
          </a>
          <span className="excel-note">シート名: 枠数設定 / 新入生 / 上回生 / 臨時</span>
        </div>
      </div>

      <hr className="section-divider" />

      <details className="csv-help">
        <summary>CSVフォーマットについて</summary>
        <div className="csv-help-content">
          <div className="csv-help-section">
            <strong>新入寮生CSV（新入生・上回生・臨時 共通）</strong>
            <p>1行に1人、ヘッダー行不要。<code>番号,名前</code> の形式。</p>
            <pre>1,山田太郎{"\n"}2,佐藤花子{"\n"}3,鈴木一郎</pre>
          </div>
          <div className="csv-help-section">
            <strong>枠数設定CSV</strong>
            <p>1行に1ブロック。<code>ブロック名,合計,ラウンド1枠数,ラウンド2枠数,...</code> の形式。</p>
            <pre>Aブロック,5,3,2{"\n"}Bブロック,4,2,2</pre>
          </div>
        </div>
      </details>

      {CATEGORY_CSV_CONFIG.map(({ category, label }) => (
        <div key={category} className="csv-row">
          <label className="csv-label">{label}</label>
          <input
            type="file"
            accept=".csv"
            onChange={(e) => handleRookieCsv(category, e)}
          />
          {rookieCounts[category] !== null && (
            <span className="csv-result">{rookieCounts[category]}名読み込み</span>
          )}
        </div>
      ))}

      <div className="csv-row">
        <label className="csv-label">枠数設定CSV</label>
        <input type="file" accept=".csv" onChange={handleBlockSlotsCsv} />
        {blockCount !== null && (
          <span className="csv-result">{blockCount}ブロック読み込み</span>
        )}
      </div>

      <style jsx>{`
        .csv-importer {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 16px 20px;
        }
        .csv-help {
          font-size: 13px;
          color: #374151;
        }
        .csv-help summary {
          cursor: pointer;
          font-weight: 600;
          font-size: 13px;
          color: #6b7280;
          user-select: none;
        }
        .csv-help-content {
          margin-top: 8px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .csv-help-section p {
          margin: 2px 0 4px;
          font-size: 12px;
          color: #6b7280;
        }
        .csv-help-section strong {
          font-size: 12px;
        }
        .csv-help-section pre {
          margin: 0;
          padding: 6px 10px;
          background: #f3f4f6;
          border-radius: 4px;
          font-size: 12px;
          line-height: 1.5;
          overflow-x: auto;
        }
        .csv-help-section code {
          background: #f3f4f6;
          padding: 1px 4px;
          border-radius: 3px;
          font-size: 12px;
        }
        .csv-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .csv-label {
          display: inline-block;
          min-width: 100px;
          font-size: 14px;
          font-weight: 600;
          margin-right: 8px;
        }
        .csv-result {
          font-size: 13px;
          color: #065f46;
          margin-left: 8px;
          background: #ecfdf5;
          padding: 2px 8px;
          border-radius: 4px;
        }
        input[type='file'] {
          font-size: 13px;
        }
        .excel-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .excel-header {
          font-size: 14px;
          font-weight: 600;
        }
        .excel-meta {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 12px;
        }
        .template-link {
          color: #2563eb;
          text-decoration: underline;
        }
        .template-link:hover {
          color: #1d4ed8;
        }
        .excel-note {
          color: #6b7280;
        }
        .section-divider {
          border: none;
          border-top: 1px solid #e5e7eb;
          margin: 4px 0;
        }
      `}</style>
    </div>
  );
}
