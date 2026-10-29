// 数理ラボを開く（共通の起動）。概念の詳細と、関係（つながりの行）の両方から使う。
// 「▶ ラボで解説」（解説付き再生：答えを見せる）と「🧪 ラボで確かめる」（自分で試す）を分け、解説を先に並べる（stats2-course #90）。
// 押すとその場に小さく埋め込み、「大きく開く ↗」で別の画面に出す。ラボの定義（値・学習目標）はラボの側にある。
import { useState } from "react";
import type { LabRef } from "./data";

export const labVerb = (l: LabRef) => (l.kind === "tour" ? "▶ ラボで解説" : "🧪 ラボで確かめる");

export default function LabLaunch({ labs, context }: { labs?: LabRef[]; context: string }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!labs?.length) return null;
  const sorted = [...labs].sort((a, b) => Number(b.kind === "tour") - Number(a.kind === "tour"));
  return (
    <div className="labs" data-testid={`labs-${context}`}>
      {sorted.map((l) => {
        const key = `${l.id}@${l.preset ?? ""}`;
        const on = open === key;
        return (
          <div key={key} className={`lab ${l.kind === "tour" ? "tour" : "check"}`}>
            <button onClick={() => setOpen(on ? null : key)} aria-expanded={on}>
              {on ? "ラボを閉じる" : labVerb(l)}
            </button>
            {l.purpose && <div className="mute lab-purpose">{l.purpose}</div>}
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
