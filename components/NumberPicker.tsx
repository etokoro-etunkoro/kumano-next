"use client";
import React, { useEffect, useRef } from "react";

type NumberPickerProps = {
    availableNumbers: number[];
    onSelect: (num: number) => void;
    onClose: () => void;
    anchorRect: { top: number; left: number; bottom: number } | null;
};

export default function NumberPicker({
    availableNumbers,
    onSelect,
    onClose,
    anchorRect,
}: NumberPickerProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    // ピッカー外クリックで閉じる
    useEffect(() => {
        if (!anchorRect) return;
        const handleMouseDown = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener("mousedown", handleMouseDown);
        return () => {
            document.removeEventListener("mousedown", handleMouseDown);
        };
    }, [anchorRect, onClose]);

    if (!anchorRect) return null;

    return (
        <div
            ref={containerRef}
            className="picker-container"
            style={{
                top: anchorRect.bottom + 5,
                left: anchorRect.left,
            }}
        >
            {availableNumbers.length === 0 ? (
                <span className="picker-empty">候補なし</span>
            ) : (
                availableNumbers.map((num) => (
                    <button
                        key={num}
                        type="button"
                        className="picker-btn"
                        onClick={() => onSelect(num)}
                    >
                        {num}
                    </button>
                ))
            )}

            <style jsx>{`
                .picker-container {
                    position: fixed;
                    z-index: 9999;
                    display: grid;
                    grid-template-columns: repeat(5, 1fr);
                    gap: 5px;
                    background: #fff;
                    border: 1px solid #aaa;
                    border-radius: 8px;
                    padding: 10px;
                    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
                }

                .picker-btn {
                    padding: 8px;
                    border: 1px solid #ccc;
                    background: #fff8f8;
                    cursor: pointer;
                    border-radius: 4px;
                    font-size: 14px;
                    min-width: 40px;
                    text-align: center;
                    transition: background 0.15s ease;
                }

                .picker-btn:hover {
                    background: #e0e7ff;
                }

                .picker-empty {
                    grid-column: 1 / -1;
                    text-align: center;
                    color: #94a3b8;
                    font-size: 14px;
                    padding: 8px;
                }
            `}</style>
        </div>
    );
}
