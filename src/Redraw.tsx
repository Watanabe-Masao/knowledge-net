// 線を押したときに、その線を矢印の向きに引き直す（渡辺さん 2026-11-07 の見本「3+ 引き直す（改）」）。
// - 元の線は呼ぶ側で薄くする。ここは上に同じ線（破線は破線のまま）を、始まりから少しずつ見せる
// - 先頭を光る小さな点（ペン先）が進む。速さはどの線でも画面の上で同じ（約 0.7px/ms）。出だしと着く前は速さを落とす
// - 引き終わると矢じりが弾んで現れ（onArrive）、少し置いて消える（onDone）。何も残さない
// - 動きを減らす設定では引かず、着いた合図（onArrive）だけを出す
import { useId, useLayoutEffect, useRef, useState } from "react";
import s from "./RelationMap.module.css";

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
/** 引く長さから時間を決める（画面の上の長さ px → ms）。短い線でも見え、長い線でも待たせない */
export const drawMs = (screenLen: number) => Math.max(450, Math.min(820, screenLen / 0.7)) * 1.1;
/** 引き終わってから元の線へ戻るまで（矢じりの弾みが見える長さ） */
const HOLD_MS = 520;

type Props = {
  d: string;
  /** 線の色（CSS の値） */
  color: string;
  dash?: string;
  /** 矢印が線の始まり側にある（終わりから始まりへ引く） */
  rev: boolean;
  /** 今の倍率（画面の上の長さと大きさをそろえる） */
  k: number;
  onArrive: () => void;
  onDone: () => void;
};

export default function Redraw({ d, color, dash, rev, k, onArrive, onDone }: Props) {
  const id = `rd${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const mask = useRef<SVGPathElement>(null);
  const nib = useRef<SVGCircleElement>(null);
  const [tip, setTip] = useState<{ x: number; y: number; ang: number } | null>(null);
  const [out, setOut] = useState(false);
  const cb = useRef({ onArrive, onDone });
  cb.current = { onArrive, onDone };
  useLayoutEffect(() => {
    const mp = mask.current!;
    const L = mp.getTotalLength();
    const at = (x: number) => mp.getPointAtLength(Math.max(0, Math.min(L, x)));
    const end = rev ? at(0) : at(L),
      before = rev ? at(2) : at(L - 2);
    const head = { x: end.x, y: end.y, ang: (Math.atan2(end.y - before.y, end.x - before.x) * 180) / Math.PI };
    const timers: number[] = [];
    const finish = () => {
      setTip(head);
      cb.current.onArrive();
      timers.push(
        window.setTimeout(() => setOut(true), HOLD_MS),
        window.setTimeout(() => cb.current.onDone(), HOLD_MS + 260),
      );
    };
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      mp.style.strokeDasharray = `${L} 1`;
      finish();
      return () => timers.forEach(clearTimeout);
    }
    const dur = drawMs(L * k),
      t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / dur),
        len = ease(t) * L;
      // 見せる所：始まりから len（逆向きは終わりから len）
      mp.style.strokeDasharray = `${len} ${L + 1}`;
      mp.style.strokeDashoffset = rev ? `${-(L - len)}` : "0";
      const p = at(rev ? L - len : len);
      const n = nib.current;
      if (n) {
        n.setAttribute("cx", `${p.x}`);
        n.setAttribute("cy", `${p.y}`);
        n.style.opacity = `${t < 0.06 ? t / 0.06 : t > 0.94 ? (1 - t) / 0.06 : 1}`;
      }
      if (t < 1) raf = requestAnimationFrame(step);
      else finish();
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const u = 1 / k; // 画面の上の 1px
  return (
    <g className={s.redraw} data-out={out ? "" : undefined} data-testid="rm-trace" data-rev={rev ? "" : undefined}>
      <defs>
        <mask id={id} maskUnits="userSpaceOnUse">
          <path
            ref={mask}
            d={d}
            style={{ fill: "none", stroke: "white", strokeWidth: 16 * u, strokeDasharray: "0 1" }}
          />
        </mask>
      </defs>
      <path d={d} mask={`url(#${id})`} style={{ stroke: color }} strokeDasharray={dash} data-state="lit" />
      {!tip && <circle ref={nib} r={3.6 * u} className={s.nib} style={{ color }} />}
      {tip && (
        <g transform={`translate(${tip.x} ${tip.y}) rotate(${tip.ang}) scale(${u})`}>
          <path d="M-9 -5 L1 0 L-9 5 Z" className={s.redrawHead} style={{ fill: color }} />
        </g>
      )}
    </g>
  );
}
