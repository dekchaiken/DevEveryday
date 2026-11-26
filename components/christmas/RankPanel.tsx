"use client";

import { useState } from "react";
import type { Ornament } from "@/lib/christmas/types";
import { Icon } from "./Icon";
import type { Board } from "./useBoard";

// แผงอันดับ: คำอวยพรและตุ๊กตาหิมะที่มีคนถูกใจมากที่สุด (สูงสุด 10 อันดับ)
export function RankPanel({
  board,
  wishes,
  onWishClick,
  open,
  onClose,
}: {
  board: Board;
  wishes: Ornament[];
  onWishClick: (o: Ornament) => void;
  open: boolean;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<"wishes" | "snowmen">("wishes");
  const rows = kind === "wishes" ? board.wishes : board.snowmen;
  return (
    <aside className={`xmas-rank-panel ${open ? "is-open" : ""}`} aria-label="อันดับถูกใจ">
      <header className="xmas-rank-head">
        <div>
          <p className="xmas-rank-eyebrow">ถูกใจมากที่สุด</p>
          <b>อันดับ</b>
        </div>
        <button type="button" className="xmas-rank-close" onClick={onClose} aria-label="ปิดอันดับ">
          <Icon name="close" size={16} />
        </button>
      </header>
      <div className="xmas-rank-tabs" role="tablist" aria-label="ประเภทอันดับ">
        <button type="button" role="tab" aria-selected={kind === "wishes"} className={kind === "wishes" ? "is-on" : ""} onClick={() => setKind("wishes")}>
          คำอวยพร
        </button>
        <button type="button" role="tab" aria-selected={kind === "snowmen"} className={kind === "snowmen" ? "is-on" : ""} onClick={() => setKind("snowmen")}>
          ตุ๊กตาหิมะ
        </button>
      </div>
      <ol className="xmas-rank-list">
        {rows.map((r, i) => {
          const o = kind === "wishes" ? wishes.find((w) => w.id === r.id) : undefined;
          const clickable = kind === "wishes" && Boolean(o);
          return (
            <li key={r.id}>
              <button
                type="button"
                disabled={!clickable}
                onClick={() => o && onWishClick(o)}
                className={i < 3 ? `is-top is-r${i + 1}` : ""}
              >
                <span className="xmas-rank-pos">{i + 1}</span>
                <span className="xmas-rank-text">
                  <b>{r.name}</b>
                  <em>{"wish" in r ? r.wish || "ขอให้มีความสุขในวันคริสต์มาส" : `ช่อง ${(r as { slot: number }).slot + 1}`}</em>
                </span>
                <span className="xmas-rank-likes">
                  <Icon name="heart" size={12} />
                  {r.likes}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      {rows.length === 0 && <p className="xmas-rank-empty">ยังไม่มีการถูกใจ กดหัวใจที่คำอวยพรหรือตุ๊กตาที่คุณชอบได้เลย</p>}
    </aside>
  );
}
