import DraftBoard from "@/components/draft/DraftBoard";


async function fetchInitial() {
const url = process.env.BACKEND_INTERNAL_URL + "/state";
try {
const res = await fetch(url!, { cache: "no-store" });
if (!res.ok) throw new Error("failed initial fetch");
return res.json();
} catch {
// stateが未生成でもレンダリングできるようにダミーを返す
return { progress: "未取得", round: null, rookies: [] };
}
}


// draft/page.tsx
export default async function DraftPage() {
  const initial = await fetchInitial();
  console.log("initial in DraftPage:", initial);
  return <DraftBoard initial={initial} />;
}
