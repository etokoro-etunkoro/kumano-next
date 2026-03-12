import XLSX from "xlsx";
import { writeFileSync } from "fs";

const wb = XLSX.utils.book_new();

const BLOCKS = ["A1", "A2", "A3", "A4", "B12", "B3", "B4", "C12", "C34"];

// ── 枠数設定シート（3枚：カテゴリ別） ──
const slotSheets = [
  // [合計, 第1巡, 第2巡]
  { name: "新入生枠数設定", sampleSlots: [[4,2,2],[5,3,2],[6,4,2],[2,1,1],[3,2,1],[2,1,1],[2,1,1],[3,2,1],[2,1,1]] },
  { name: "上回生枠数設定", sampleSlots: [[2,1,1],[2,1,1],[2,1,1],[3,2,1],[1,1,0],[1,1,0],[1,1,0],[1,1,0],[1,1,0]] },
  { name: "臨キャパ枠数設定", sampleSlots: [[2,1,1],[1,1,0],[2,1,1],[1,1,0],[1,1,0],[0,0,0],[0,0,0],[1,1,0],[0,0,0]] },
];

for (const { name, sampleSlots } of slotSheets) {
  const data = [["ブロック名", "合計", "第1巡枠数", "第2巡枠数"]];
  BLOCKS.forEach((block, i) => data.push([block, ...sampleSlots[i]]));
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = [{ wch: 14 }, { wch: 8 }, { wch: 12 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws, name);
}

// ── 寮生一覧シート（3枚：カテゴリ別） ──
const rookieSheets = [
  { name: "新入生一覧", samples: [[1, "山田太郎"], [2, "佐藤花子"], [3, "鈴木一郎"]] },
  { name: "上回生一覧", samples: [[1, "田中二郎"], [2, "高橋三郎"]] },
  { name: "臨キャパ一覧", samples: [[1, "渡辺四郎"], [2, "伊藤五郎"]] },
];

for (const { name, samples } of rookieSheets) {
  const data = [["番号", "氏名"], ...samples];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = [{ wch: 8 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws, name);
}

const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
writeFileSync("public/template/kumano_draft_template.xlsx", buf);
console.log("Template generated: public/template/kumano_draft_template.xlsx");
