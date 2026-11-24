// 分類の中の概念の一覧（stats2-course #228）。ライブラリで分類を開いた中に出す（issue 601：分類の1枚のページはなくした）。
// 分類の語を学ぶ順に、意味のまとまり（教材の groups）で区切って1行ずつ（印・名前・定義1文）。語を押すと概念のページ。
// 前の正方形の並べ方・長押しの定義1文・並べ方の切り替えは外した（一覧は定義1文が見えている。関係図はライブラリの「関係図で見る」）。
// データは公開データにあるもの（語の印・名前・定義1文・前提の関係）だけで作る
import { type Network, bandOfCat, bandsOf, learningOrder, written, lead } from "./data";
import { conceptIcon } from "./conceptIcons";
import { iconUri } from "./icons";
import s from "./CategoryList.module.css";

type Props = {
  net: Network;
  category: string;
  onConcept: (id: string) => void;
};

export default function CategoryList({ net, category, onConcept }: Props) {
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

  return (
    <section className={s.page} style={{ "--tint": `var(${tint})` } as React.CSSProperties} data-testid="category-list">
      {sections.map((sec) => (
        <div key={sec.id} className={s.section} data-testid={`cat-section-${sec.id}`}>
          {sec.name ? (
            <div className={s.secHead}>
              <h3>{sec.name}</h3>
              {sec.summary ? <p>{sec.summary}</p> : null}
            </div>
          ) : null}
          <ol className={s.list} aria-label={`${sec.name ?? category}の概念（学ぶ順）`}>
            {sec.items.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className={`${s.row}${written(c) ? "" : ` ${s.skeleton}`}`}
                  onClick={() => onConcept(c.id)}
                  data-testid={`cat-item-${c.id}`}
                >
                  <span className={s.rowGlyph}>{glyph(c)}</span>
                  <span className={s.rowText}>
                    <b>{c.name}</b>
                    {lead(c) ? <small>{lead(c)}</small> : null}
                  </span>
                  <span className={s.chev} aria-hidden="true">
                    ›
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </section>
  );
}
