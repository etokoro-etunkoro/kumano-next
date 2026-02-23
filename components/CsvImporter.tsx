"use client";

import { useState } from "react";
import type { Rookie } from "@/types/rookie";
import type { BlockSlotsConfig } from "@/types/block-slots";

type CsvImporterProps = {
  onRookiesImport: (rookies: Rookie[]) => void;
  onBlockSlotsImport: (config: BlockSlotsConfig, maxRound: number) => void;
};

export default function CsvImporter({
  onRookiesImport,
  onBlockSlotsImport,
}: CsvImporterProps) {
  const [rookieCount, setRookieCount] = useState<number | null>(null);
  const [blockCount, setBlockCount] = useState<number | null>(null);

  function handleRookieCsv(e: React.ChangeEvent<HTMLInputElement>) {
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
          category: "freshman" as const,
          remaining: true,
        });
      }

      setRookieCount(rookies.length);
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
      const config: BlockSlotsConfig = {};
      let maxRound = 0;

      for (const line of text.split("\n")) {
        const parts = line.trim().split(",");
        const blockName = parts[0];
        if (!blockName || isNaN(parseInt(parts[1], 10))) continue;

        const slots = parts.slice(2).map(Number);
        config[blockName] = {
          freshman: slots,
          upperclassman: slots.map(() => 0),
          temporary: slots.map(() => 0),
        };
        maxRound = Math.max(maxRound, slots.length);
      }

      setBlockCount(Object.keys(config).length);
      onBlockSlotsImport(config, maxRound);
    };
    reader.readAsText(file);
  }

  return (
    <div className="csv-importer">
      <div>
        <label className="csv-label">📄 新入寮生CSV</label>
        <input type="file" accept=".csv" onChange={handleRookieCsv} />
        {rookieCount !== null && (
          <span className="csv-result">✅ {rookieCount}名読み込み</span>
        )}
      </div>

      <div>
        <label className="csv-label">📄 枠数設定CSV</label>
        <input type="file" accept=".csv" onChange={handleBlockSlotsCsv} />
        {blockCount !== null && (
          <span className="csv-result">✅ {blockCount}ブロック読み込み</span>
        )}
      </div>

      <style jsx>{`
        .csv-importer {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 12px;
        }
        .csv-label {
          font-size: 14px;
          font-weight: 600;
          margin-right: 8px;
        }
        .csv-result {
          font-size: 13px;
          color: #065f46;
          margin-left: 8px;
        }
      `}</style>
    </div>
  );
}
