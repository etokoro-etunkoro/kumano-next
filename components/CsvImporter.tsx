"use client";

import { useState } from "react";
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
      `}</style>
    </div>
  );
}
