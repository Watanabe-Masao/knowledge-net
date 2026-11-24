// 分類のライブラリ：知識の全体像の入口（stats2-course の issue 601。渡辺さん 2026-11-24）。
// 3つの柱（データを記述する → 確率で考える → 推測する）の見出しの下に、分類を1行ずつ（印・名前・概念の数・実験の数）。
// 分類を押すと、その場で開いて、その分類の全部の概念を学ぶ順に（意味のまとまりで区切って）出し、最後に「関係図で見る」。
// 開くのは1つだけ（画面の原則 15）。開いている分類は URL（?g=分類）に持ち、戻ると同じ所（画面の原則 3）。
// 前は代表の3語のタイルと「ほかの概念」で、押すと分類の1枚のページへ移った（そのページはなくした）。
// 柱は教材の course.pillars（stats2-course #220）。
import { useLayoutEffect, useRef } from "react";
import { labCountOf } from "./Shell";
import { iconUri } from "./icons";
import { type Network, bandOfCat, bandsOf } from "./data";
import CategoryList from "./CategoryList";
import s from "./Library.module.css";

type Props = {
  net: Network;
  /** 開いている分類（null＝どれも開いていない） */
  open: string | null;
  /** 分類を開く・閉じる（閉じるときは null） */
  onToggle: (category: string | null) => void;
  onConcept: (id: string) => void;
  /** その分類の関係図のページを開く */
  onMap: (category: string) => void;
};

export default function Library({ net, open, onToggle, onConcept, onMap }: Props) {
  const all = [...net.concepts.values()];
  const cats = [...new Set(all.map((c) => c.category).filter((x): x is string => !!x))];
  const bands = bandsOf(net);
  const bandOf = (c: string) => bandOfCat(bands, c);
  const mute = getComputedStyle(document.documentElement).getPropertyValue("--ink-3").trim() || "gray"; // 印の色（tokens の値を読む）

  // 開いた行が、押した所から動かないように（上で開いていた分類が閉じると、押した行が上へずれる）
  const anchor = useRef<{ cat: string; top: number } | null>(null);
  const toggle = (cat: string, el: HTMLElement) => {
    anchor.current = { cat, top: el.getBoundingClientRect().top };
    onToggle(open === cat ? null : cat);
  };
  useLayoutEffect(() => {
    const a = anchor.current;
    anchor.current = null;
    if (a) {
      const el = document.querySelector(`[data-testid="lib-${a.cat}"]`);
      if (el) scrollBy(0, el.getBoundingClientRect().top - a.top);
    }
  }, [open]);
  // 開いたとき：戻ってきたなら離れた所から（送った位置はこのページの履歴に持つ。画面の原則 3）。
  // URL で分類を開いて来た（Notion の「忘れたら」など）なら、その分類の行を上に。路線図から来たらページの上から
  useLayoutEffect(() => {
    const y = (history.state as { libY?: number } | null)?.libY;
    if (typeof y === "number") scrollTo(0, y);
    else if (open) document.querySelector(`[data-testid="lib-${open}"]`)?.scrollIntoView({ block: "start" });
    let t: ReturnType<typeof setTimeout> | undefined;
    const keep = () => {
      clearTimeout(t);
      t = setTimeout(() => history.replaceState({ ...history.state, libY: scrollY }, ""), 120);
    };
    addEventListener("scroll", keep, { passive: true });
    return () => {
      // 離れるとき（概念のページ・関係図へ進む）に今の位置を残す。URL を書き換える前なので、このページの履歴に入る
      clearTimeout(t);
      removeEventListener("scroll", keep);
      history.replaceState({ ...history.state, libY: scrollY }, "");
    };
    // 開いたときだけ（開き直しは上の anchor で扱う）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={s.lib} data-testid="library">
      {bands.map((b) => {
        const mine = b.cats
          .filter((c) => cats.includes(c))
          .concat(cats.filter((c) => bandOf(c) === b.id && !b.cats.includes(c)));
        if (!mine.length) return null;
        return (
          <section key={b.id} className={s.band} style={{ "--tint": `var(${b.tint})` } as React.CSSProperties}>
            <h3 className={s.bandName}>
              <span className={s.dot} aria-hidden />
              {b.name}
            </h3>
            <ul className={s.cats}>
              {mine.map((cat) => {
                const n = all.filter((c) => c.category === cat).length,
                  labs = labCountOf(net, cat),
                  icon = iconUri(cat, mute),
                  on = open === cat;
                return (
                  <li key={cat} className={s.cat}>
                    <button
                      type="button"
                      className={s.catRow}
                      aria-expanded={on}
                      aria-controls={`lib-body-${cat}`}
                      onClick={(e) => toggle(cat, e.currentTarget)}
                      data-testid={`lib-${cat}`}
                    >
                      <span className={s.catIcon}>{icon ? <img src={icon} alt="" /> : null}</span>
                      <span className={s.catText}>
                        <b>{cat}</b>
                        {labs ? <span className={s.labs}>実験 {labs}</span> : null}
                        <span className={s.count} aria-label={`${n}概念`}>
                          {n}
                        </span>
                      </span>
                      <span className={s.chev} aria-hidden="true">
                        ›
                      </span>
                    </button>
                    {on ? (
                      <div id={`lib-body-${cat}`} className={s.body}>
                        <CategoryList net={net} category={cat} onConcept={onConcept} />
                        <button
                          type="button"
                          className={s.map}
                          onClick={() => onMap(cat)}
                          data-testid={`lib-map-${cat}`}
                        >
                          関係図で見る
                        </button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
