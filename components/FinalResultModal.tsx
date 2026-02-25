"use client";

export function mergeGetDict(
  prev: Record<string, Array<string | number>>,
  current: Record<string, Array<string | number>>
): Record<string, Array<string | number>> {
  const result = { ...prev };
  for (const block in current) {
    if (!(block in result)) result[block] = [];
    for (const num of current[block]) {
      if (!result[block].includes(num)) {
        result[block].push(num);
        result[block].sort((a, b) => Number(a) - Number(b));
      }
    }
  }
  return result;
}

type FinalResultModalProps = {
  isOpen: boolean;
  onClose: () => void;
  totalGetDict: Record<string, Array<string | number>>;
  rookies: Array<{ id: number; name?: string }>;
};

export default function FinalResultModal({
  isOpen,
  onClose,
  totalGetDict,
  rookies,
}: FinalResultModalProps) {
  if (!isOpen) return null;

  const blocks = Object.keys(totalGetDict);
  const nameMap = new Map(rookies.map((r) => [r.id, r.name]));

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="title">🎉 ドラフト結果</h2>
        <div className="block-list">
          {blocks.map((block) => {
            const members = totalGetDict[block];
            return (
              <div key={block} className="block-row">
                <span className="block-name">{block}</span>
                {members.length > 0 ? (
                  <span className="block-members">
                    {members.map((m) => {
                      const name = nameMap.get(Number(m));
                      return name ? `${m} ${name}` : String(m);
                    }).join(", ")}
                  </span>
                ) : (
                  <span className="block-empty">なし</span>
                )}
              </div>
            );
          })}
        </div>
        <div className="btn-wrap">
          <button className="close-btn" onClick={onClose}>
            閉じる
          </button>
        </div>
      </div>
      <style jsx>{`
        .overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .modal {
          background: white;
          border-radius: 16px;
          padding: 24px;
          max-width: 600px;
          width: 90%;
          max-height: 80vh;
          overflow-y: auto;
        }
        .title {
          font-size: 20px;
          font-weight: bold;
          margin-bottom: 16px;
        }
        .block-row {
          padding: 8px 0;
          border-bottom: 1px solid #e5e7eb;
        }
        .block-name {
          font-weight: bold;
          margin-right: 8px;
        }
        .block-name::after {
          content: ":";
        }
        .block-empty {
          color: #9ca3af;
        }
        .btn-wrap {
          margin-top: 16px;
          text-align: center;
        }
        .close-btn {
          padding: 8px 24px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          background: #f9fafb;
          font-size: 14px;
          cursor: pointer;
        }
        .close-btn:hover {
          background: #e5e7eb;
        }
      `}</style>
    </div>
  );
}
