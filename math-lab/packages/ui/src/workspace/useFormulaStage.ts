// 2 主役の式の舞台（Workspace.tsx から分けた。stats2-course #212）：選んだかたまり・記号の強調、かたまりの囲みの位置、
// 開く・たたむときの動き（FLIP）、式を押したときの選び。DOM を測る所はここだけ
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { flash, reduced, tokenMs } from "../motion";
import type { Sel } from "./shared";

export type Box = { i: number; x: number; y: number; w: number; h: number };

export function useFormulaStage(html: string, sel: Sel, setSel: (s: Sel) => void) {
  const stage = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = stage.current;
    if (!root) return;
    root
      .querySelectorAll<HTMLElement>("[data-part]")
      .forEach((el) => el.toggleAttribute("data-on", sel?.part !== undefined && el.dataset.part === String(sel.part)));
    // 選んだ記号は式の中の全部の場所を強調する（同じ p が2つのかたまりにある）。選んだかたまりの中は強く
    root.querySelectorAll<HTMLElement>("[data-sym]").forEach((el) => {
      const on = !!sel?.sym && el.dataset.sym === sel.sym;
      el.toggleAttribute("data-on", on);
      el.toggleAttribute(
        "data-here",
        on && (sel?.part === undefined || el.closest(`[data-part="${sel.part}"]`) !== null),
      );
    });
  }, [html, sel]);
  // ---- かたまりの囲み：KaTeX の要素の箱は分数の分母などを含まないので、描いた字（葉の要素）の実際の位置を合わせた範囲で囲む。
  // 式が変わる・幅が変わる・字が読み込まれるたびに測り直す（線が式に重ならないように） ----
  const wrap = useRef<HTMLDivElement>(null);
  const [boxes, setBoxes] = useState<Box[]>([]);
  useLayoutEffect(() => {
    const root = stage.current,
      outer = wrap.current;
    if (!root || !outer) return;
    const measure = () => {
      const o = outer.getBoundingClientRect();
      const out: typeof boxes = [];
      root.querySelectorAll<HTMLElement>("[data-part]").forEach((el) => {
        let l = Infinity,
          t = Infinity,
          r = -Infinity,
          b = -Infinity;
        el.querySelectorAll<HTMLElement | SVGElement>("*").forEach((c) => {
          const leaf = c.children.length === 0 || c.tagName.toLowerCase() === "svg";
          if (!leaf || (c.closest("svg") !== c && c.closest("svg"))) return;
          const cls = typeof c.className === "string" ? c.className : "";
          if (/\b(strut|vlist-s|pstrut|nulldelimiter|mspace)\b/.test(cls)) return;
          const q = c.getBoundingClientRect();
          if (q.width < 0.5 || q.height < 0.5) return;
          l = Math.min(l, q.left);
          t = Math.min(t, q.top);
          r = Math.max(r, q.right);
          b = Math.max(b, q.bottom);
        });
        if (l < r)
          out.push({
            i: Number(el.dataset.part),
            x: l - o.left + outer.scrollLeft - 2,
            y: t - o.top - 2,
            w: r - l + 4,
            h: b - t + 5,
          });
      });
      setBoxes(out);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(outer);
    document.fonts?.ready.then(measure).catch(() => undefined);
    return () => ro.disconnect();
  }, [html]);

  // 選んだかたまりの囲みは1つだけ置き、かたまりを替えると前の場所から滑って移る（分解すると大きさが変わる）。選びをやめると消える
  const lastBox = useRef<(typeof boxes)[number] | null>(null);
  const found = boxes.find((b) => b.i === sel?.part);
  if (found) lastBox.current = found;
  const selBox = found ?? lastBox.current;
  // かたまりを選んだ瞬間だけ、囲みを少し大きくしてから戻す（どこを選んだかに目が行くように）
  const selEl = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (sel?.part === undefined || reduced() || !selEl.current?.animate) return;
    selEl.current.animate(
      [{ transform: "scale(1)" }, { transform: "scale(1.07)", offset: 0.45 }, { transform: "scale(1)" }],
      { duration: tokenMs("--dur-sheet", 320), easing: "cubic-bezier(.2,.8,.2,1)" },
    );
  }, [sel?.part]);

  // ---- その場で展開する動き（FLIP。手本：FormulaNode 計算ツリー） ----
  // 開く・閉じる前に記号の位置を覚え、描き直したあと、残った記号は前の位置から滑らせ、新しく出た所は開いた記号の位置から広げる
  const before = useRef<{ rects: Map<string, DOMRect>; origin?: DOMRect; key?: string } | null>(null);
  const snapshot = (originKey?: string) => {
    const rects = new Map<string, DOMRect>(),
      count = new Map<string, number>();
    let origin: DOMRect | undefined;
    stage.current?.querySelectorAll<HTMLElement>("[data-sym]").forEach((el) => {
      const k = el.dataset.sym!,
        i = count.get(k) ?? 0;
      count.set(k, i + 1);
      const r = el.getBoundingClientRect();
      rects.set(`${k}#${i}`, r);
      if (k === originKey && !origin) origin = r;
    });
    before.current = { rects, origin, key: originKey };
  };
  useLayoutEffect(() => {
    const b = before.current;
    before.current = null;
    if (!b || !stage.current || reduced()) return;
    const count = new Map<string, number>();
    stage.current.querySelectorAll<HTMLElement>("[data-sym]").forEach((el) => {
      const k = el.dataset.sym!,
        i = count.get(k) ?? 0;
      count.set(k, i + 1);
      const o = b.rects.get(`${k}#${i}`),
        r = el.getBoundingClientRect();
      const fresh = el.closest(`[data-open="${b.key}"]`);
      if (fresh && b.origin) {
        el.animate(
          [
            { transform: `translate(${b.origin.left - r.left}px, ${b.origin.top - r.top}px) scale(.4)`, opacity: 0 },
            { transform: "none", opacity: 1 },
          ],
          { duration: 360, easing: "cubic-bezier(.2,.8,.2,1)" },
        );
      } else if (o && (Math.abs(o.left - r.left) > 0.5 || Math.abs(o.top - r.top) > 0.5)) {
        el.animate([{ transform: `translate(${o.left - r.left}px, ${o.top - r.top}px)` }, { transform: "none" }], {
          duration: 320,
          easing: "cubic-bezier(.2,.8,.2,1)",
        });
      }
    });
    if (b.key) stage.current.querySelectorAll(`[data-open="${b.key}"]`).forEach((el) => flash(el));
  }, [html]);

  const onStage = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    const part = t.closest<HTMLElement>("[data-part]"),
      sym = t.closest<HTMLElement>("[data-sym]");
    // かたまりの中なら、まずかたまりを選ぶ。選んだかたまりの中の記号を押すと、かたまりを選んだまま記号も選ぶ（同じ記号ならたたむ）
    const pi = part ? Number(part.dataset.part) : undefined,
      k = sym?.dataset.sym;
    if (pi !== undefined)
      setSel(sel?.part === pi && k ? { part: pi, sym: sel.sym === k ? undefined : k } : { part: pi });
    else if (k) setSel(sel?.sym === k && sel.part === undefined ? null : { sym: k });
    else setSel(null);
  };
  return { stage, wrap, boxes, selBox, selEl, snapshot, onStage };
}
