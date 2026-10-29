// 数理ラボを開く（共通の起動）。概念の詳細と、関係（つながりの行）の両方から使う。
// 押すとその場に小さく埋め込み、「大きく開く ↗」で別の画面に出す。ラボの定義（値・学習目標）はラボの側にある。
import { useState } from "react";
import type { LabRef } from "./data";

export default function LabLaunch({ labs, context }: { labs?: LabRef[]; context: string }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!labs?.length) return null;
  return (
    <div className="labs" data-testid={`labs-${context}`}>
      {labs.map((l) => {
        const key = `${l.id}@${l.preset ?? ""}`;
        const on = open === key;
        return (
          <div key={key} className="lab">
            <button onClick={() => setOpen(on ? null : key)} aria-expanded={on}>
              🧪 {on ? "ラボを閉じる" : `ラボで確かめる：${l.title ?? l.id}`}
            </button>
            {l.purpose && <span className="mute"> {l.purpose}</span>}
            {on && <>
              <iframe src={`${l.url}${l.url.includes("?") ? "&" : "?"}embed=1`} title={l.title ?? l.id} loading="lazy" />
              <a href={l.url} target="_blank" rel="noreferrer">大きく開く ↗</a>
            </>}
          </div>
        );
      })}
    </div>
  );
}
