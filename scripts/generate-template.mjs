import XLSX from "xlsx";
import { writeFileSync } from "fs";

const wb = XLSX.utils.book_new();

// シート「枠数設定」
const blockData = [
  ["ブロック名", "合計", "第1巡枠数", "第2巡枠数"],
  ["Aブロック", 5, 3, 2],
  ["Bブロック", 4, 2, 2],
];
const wsBlock = XLSX.utils.aoa_to_sheet(blockData);
wsBlock["!cols"] = [{ wch: 14 }, { wch: 8 }, { wch: 12 }, { wch: 12 }];
XLSX.utils.book_append_sheet(wb, wsBlock, "枠数設定");

// シート「新入生」
const freshmanData = [
  ["番号", "名前"],
  [1, "山田太郎"],
  [2, "佐藤花子"],
];
const wsFreshman = XLSX.utils.aoa_to_sheet(freshmanData);
wsFreshman["!cols"] = [{ wch: 8 }, { wch: 16 }];
XLSX.utils.book_append_sheet(wb, wsFreshman, "新入生");

// シート「上回生」
const upperData = [
  ["番号", "名前"],
  [1, "鈴木一郎"],
];
const wsUpper = XLSX.utils.aoa_to_sheet(upperData);
wsUpper["!cols"] = [{ wch: 8 }, { wch: 16 }];
XLSX.utils.book_append_sheet(wb, wsUpper, "上回生");

// シート「臨時」
const tempData = [
  ["番号", "名前"],
  [1, "高橋次郎"],
];
const wsTemp = XLSX.utils.aoa_to_sheet(tempData);
wsTemp["!cols"] = [{ wch: 8 }, { wch: 16 }];
XLSX.utils.book_append_sheet(wb, wsTemp, "臨時");

const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
writeFileSync("public/template/kumano_draft_template.xlsx", buf);
console.log("Template generated: public/template/kumano_draft_template.xlsx");
