// 分類のページのリストビュー（stats2-course #228。渡辺さん 2026-11-05「F・G は切り替え可能で、これがとりあえずリストビュー」）。
// ライブラリ（入口・機能別の地図）でタイルを押したあとの画面。分類の語を学ぶ順に並べ、2つの並べ方を切り替える：
//   正方形（印と名前・横4つ。長押しで定義1文）／一覧（印・名前・定義1文）。地図（島の地図）へも切り替えられる。
// 語を押すと概念のページ。データは公開データにあるもの（語の印・名前・定義1文・前提の関係）だけで作る
import { tokenMs } from "@math-lab/ui";
import { useRef, useState } from "react";
import { type Network, bandOfCat, bandsOf, learningOrder } from "./data";
import { conceptIcon } from "./conceptIcons";
import { iconUri } from "./icons";
import s from "./CategoryList.module.css";

export type CategoryLayout = "grid" | "list" | "map";

/** 正方形・一覧・地図の切り替え（分類のページの上。地図のときも同じ所に出す） */
export function LayoutSwitch({ value, onChange }: { value: CategoryLayout; onChange: (v: CategoryLayout) => void }) {
  const items: [CategoryLayout, string, string][] = [
    ["grid", "正方形で並べる", "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"],
    ["list", "一覧で並べる", "M4 6h16M4 12h16M4 18h16"],
    [
      "map",
      "地図で見る",
      "M6 6.5a2 2 0 1 0 0 .01M18 6.5a2 2 0 1 0 0 .01M12 17.5a2 2 0 1 0 0 .01M7.5 8l3.5 8M16.5 8l-3.5 8",
    ],
  ];
  return (
    <div className={s.switch} role="radiogroup" aria-label="並べ方" data-testid="cat-layout">
      {items.map(([v, label, d]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          aria-label={label}
          title={label}
          onClick={() => onChange(v)}
          data-testid={`cat-layout-${v}`}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d={d} />
          </svg>
        </button>
      ))}
    </div>
  );
}

type Props = {
  net: Network;
  category: string;
  layout: Exclude<CategoryLayout, "map">;
  onConcept: (id: string) => void;
};

const holdMs = () => tokenMs("--dur-hold", 450); // 長押しとみなす長さ（押さえている間は沈んで光る。base.css の data-hold）

export default function CategoryList({ net, category, layout, onConcept }: Props) {
  const ids = [...net.concepts.values()].filter((c) => c.category === category).map((c) => c.id);
  const order = learningOrder(net, ids).map((id) => net.concepts.get(id)!);
  // 意味のまとまり（教材の groups。stats2-course #228）：あればまとまりごとに区切る（まとまりの順＝教材の順、中は学ぶ順）。
  // まとまりに入っていない語は最後に「そのほか」。まとまりのない分類は区切らない
  const groups = net.groups.filter((g) => g.category === category);
  const sections: { id: string; name?: string; summary?: string; items: typeof order }[] = groups.length
    ? [
        ...groups.map((g) => ({ ...g, items: order.filter((c) => c.group === g.id) })),
        { id: "rest", name: "そのほか", items: order.filter((c) => !groups.some((g) => g.id === c.group)) },
      ].filter((x) => x.items.length)
    : [{ id: "all", items: order }];
  const bands = bandsOf(net);
  const tint = bands.find((b) => b.id === bandOfCat(bands, category))?.tint ?? "--ink-3";
  const mute = getComputedStyle(document.documentElement).getPropertyValue("--ink-3").trim() || "gray";
  const fallback = iconUri(category, mute);
  const glyph = (c: (typeof order)[number]) =>
    conceptIcon(c.icon, net.iconRoots) ?? (fallback ? <img src={fallback} alt="" /> : null);

  // 長押し：押さえて HOLD_MS たつと定義1文を出す。出したあとに離した押しは、ページへ移らない
  const [tip, setTip] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    held = useRef(false);
  const hold = (id: string) => ({
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      held.current = false;
      const el = e.currentTarget;
      el.setAttribute("data-hold", "");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        el.removeAttribute("data-hold");
        held.current = true;
        setTip(id);
      }, holdMs());
    },
    onPointerUp: (e: React.PointerEvent<HTMLElement>) => {
      e.currentTarget.removeAttribute("data-hold");
      if (timer.current) clearTimeout(timer.current);
      setTip(null);
    },
    onPointerLeave: (e: React.PointerEvent<HTMLElement>) => {
      e.currentTarget.removeAttribute("data-hold");
      if (timer.current) clearTimeout(timer.current);
      setTip(null);
    },
    onPointerCancel: (e: React.PointerEvent<HTMLElement>) => {
      e.currentTarget.removeAttribute("data-hold");
      if (timer.current) clearTimeout(timer.current);
      setTip(null);
    },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(), // iPhone の長押しのメニューを出さない
    onClick: () => {
      if (held.current) {
        held.current = false;
        return;
      }
      onConcept(id);
    },
  });

  return (
    <section
      className={s.page}
      style={{ "--tint": `var(${tint})` } as React.CSSProperties}
      data-testid="category-list"
      data-layout={layout}
    >
      {sections.map((sec) => (
        <div key={sec.id} className={s.section} data-testid={`cat-section-${sec.id}`}>
          {sec.name ? (
            <div className={s.secHead}>
              <h3>{sec.name}</h3>
              {sec.summary ? <p>{sec.summary}</p> : null}
            </div>
          ) : null}
          {layout === "grid" ? (
            <ol className={s.grid} aria-label={`${sec.name ?? category}の概念（学ぶ順）`}>
              {sec.items.map((c) => (
                <li key={c.id} className={s.cellWrap}>
                  <button
                    type="button"
                    className={`${s.cell}${c.status === "filled" ? "" : ` ${s.skeleton}`}`}
                    aria-describedby={tip === c.id ? "cat-tip" : undefined}
                    data-testid={`cat-item-${c.id}`}
                    {...hold(c.id)}
                  >
                    <span className={s.glyph}>{glyph(c)}</span>
                    <span className={s.name}>{c.name}</span>
                  </button>
                  {tip === c.id && (c.short ?? c.definition) ? (
                    <div id="cat-tip" role="tooltip" className={s.tip} data-testid="cat-tip">
                      <b>{c.name}</b>
                      <span>{c.short ?? c.definition}</span>
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <ol className={s.list} aria-label={`${sec.name ?? category}の概念（学ぶ順）`}>
              {sec.items.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className={`${s.row}${c.status === "filled" ? "" : ` ${s.skeleton}`}`}
                    onClick={() => onConcept(c.id)}
                    data-testid={`cat-item-${c.id}`}
                  >
                    <span className={s.rowGlyph}>{glyph(c)}</span>
                    <span className={s.rowText}>
                      <b>{c.name}</b>
                      {(c.short ?? c.definition) ? <small>{c.short ?? c.definition}</small> : null}
                    </span>
                    <span className={s.chev} aria-hidden="true">
                      ›
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
      ))}
    </section>
  );
}
