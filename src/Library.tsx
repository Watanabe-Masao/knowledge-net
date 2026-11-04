// 分類のライブラリ（試作）：全体の入口を、iPhone のアプリライブラリに近い形で見せる。
// 3つの柱（データを記述する → 確率で考える → 推測する）の見出しの下に、分類のタイルを2列で並べる。
// タイル：大きな枠3つ＝代表の語（説明のある語を先に、つながりの多い順）、4つ目＝「ほか○語」。押すと語は概念のページ、4つ目と名前は分類の地図。
// 語には個別の印がない（分類ごとの共通の印。CLAUDE.md）ので、枠は名前を主にし、分布の図のデータ（chart）を持つ語だけ小さな形を添える。
// ※ 柱の分け方は試作のため画面に書いている（Graph.tsx の BANDS）。本番では教材のデータから読む。
import { BANDS } from "./Graph";
import { iconUri } from "./icons";
import { type Network } from "./data";
import s from "./Library.module.css";
import { conceptIcon } from "./conceptIcons";

type Props = { net: Network; onConcept: (id: string) => void; onGroup: (category: string) => void };

export default function Library({ net, onConcept, onGroup }: Props) {
  const all = [...net.concepts.values()];
  const degree = new Map<string, number>();
  for (const r of net.relations) { degree.set(r.from, (degree.get(r.from) ?? 0) + 1); degree.set(r.to, (degree.get(r.to) ?? 0) + 1); }
  const labsOf = (cat: string) => [...net.experiments.values()].filter((x) => net.concepts.get(x.links?.concepts?.[0] ?? "")?.category === cat)
    .reduce((t, x) => t + ("catalog" in x && x.catalog ? x.catalog.flatMap((g) => g.items).length : 1), 0);
  const cats = [...new Set(all.map((c) => c.category).filter((x): x is string => !!x))];
  const bandOf = (c: string) => BANDS.find((b) => b.cats.includes(c))?.id ?? BANDS[BANDS.length - 1].id;
  const mute = getComputedStyle(document.documentElement).getPropertyValue("--ink-3").trim() || "gray";   // 印の色（tokens の値を読む）

  return (
    <div className={s.lib} data-testid="library">
      {BANDS.map((b) => {
        const mine = b.cats.filter((c) => cats.includes(c)).concat(cats.filter((c) => bandOf(c) === b.id && !b.cats.includes(c)));
        if (!mine.length) return null;
        return (
          <section key={b.id} className={s.band} style={{ "--tint": `var(${b.tint})` } as React.CSSProperties}>
            <h3 className={s.bandName}><span className={s.dot} aria-hidden />{b.name}</h3>
            <div className={s.grid}>
              {mine.map((cat) => {
                const cs = all.filter((c) => c.category === cat)
                  .sort((x, y) => Number(y.status === "filled") - Number(x.status === "filled") || (degree.get(y.id) ?? 0) - (degree.get(x.id) ?? 0));
                const top = cs.slice(0, 3), rest = cs.length - top.length, labs = labsOf(cat), icon = iconUri(cat, mute);
                return (
                  <div key={cat} className={s.tileWrap}>
                    <div className={s.tile} data-testid={`lib-${cat}`}>
                      {top.map((c) => (
                        <button key={c.id} type="button" className={`${s.cell}${c.status === "filled" ? "" : ` ${s.skeleton}`}`} onClick={() => onConcept(c.id)} title={c.short ?? c.definition}>
                          {/* アプリの印のように：語の特徴の絵を大きく、名前は小さく下に。固有の絵がない語は分類の印 */}
                          <span className={s.glyph}>{conceptIcon(c.id) ?? (icon && <img src={icon} alt="" />)}</span>
                          <span className={s.cellName}>{c.name}</span>
                        </button>
                      ))}
                      <button type="button" className={`${s.cell} ${s.more}`} onClick={() => onGroup(cat)} aria-label={`${cat}の語をすべて地図で見る`}>
                        {rest > 0 ? <><b className={s.moreNum}>{rest}</b><span className={s.moreUnit}>ほかの語</span></> : <span className={s.moreUnit}>地図で見る</span>}
                      </button>
                    </div>
                    {/* 分類の名前は見出しだけ（地図を開くのは4つ目の枠の1か所。同じ機能を2か所に置かない） */}
                    <div className={s.tileName}>
                      <span>{cat}</span>
                      {labs ? <span className={s.labs}>実験 {labs}</span> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
