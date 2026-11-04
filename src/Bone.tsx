// 成り立ちのボーン（試作）：1つの概念が「何から成り立つか」を、縦の背骨と骨で見せる（特性要因図の形）。
// 頭＝概念と式。骨は4本：材料（式の記号）・前提の概念・成り立つ条件・平均と分散（導出）。
// 条件の骨には、その条件を崩す反例（実験室のデータの counterexamples[].breaks）と、崩して確かめる問い（catalog の open: "break:反例"）をつなぐ。
// 画面の骨組みは全画面のページと同じ（上に「←・題」、中は指で送る、下に次の1手）。
import katex from "katex";
import { Button } from "@math-lab/ui";
import { type Concept, type Network } from "./data";
import s from "./Bone.module.css";

type Props = { net: Network; concept: Concept; onBack: () => void; href: (q: Record<string, string>) => string };

const tex = (t: string, display = false) => ({ __html: katex.renderToString(t, { throwOnError: false, displayMode: display }) });
const nameOf = (net: Network, id: string) => net.concepts.get(id)?.name ?? id.split(":").pop()!;

/** 条件の文と反例の breaks（「・」区切り）が同じ条件を指すか。教材の言い方の小さな違い（「の」の有無）は許す */
/** 長い説明は1文目だけを出し、残りはたたむ（骨の形が文字で埋まらないように） */
function Lead({ text }: { text: string }) {
  let d = 0, i = -1; for (let j = 0; j < text.length && i < 0; j++) { const ch = text[j]; if (ch === "（") d++; else if (ch === "）") d--; else if (ch === "。" && d <= 0) i = j; }   // 括弧の外の「。」で切る
  const head = i >= 0 ? text.slice(0, i + 1) : text, rest = i >= 0 ? text.slice(i + 1).trim() : "";
  return rest ? <details className={s.more}><summary><small>{head}</small><span className={s.moreBtn}>くわしく</span></summary><small>{rest}</small></details> : <small>{head}</small>;
}
const same = (a: string, b: string) => a.replace(/\s|の/g, "") === b.replace(/\s|の/g, "");

export default function Bone({ net, concept: c, onBack, href }: Props) {
  const main = c.formulas?.[0];
  const params = (main?.symbols ?? []).filter((x) => x.kind === "param" || x.kind === "value");
  const premises = net.relations.filter((r) => r.to === c.id && (r.type === "前提" || r.type === "一般化"));
  const der = net.derivations.filter((d) => d.conclusion === c.id);
  const exps = [...net.experiments.values()].filter((x) => x.links?.concepts?.includes(c.id));
  const breaks = (cond: string) => exps.flatMap((x) => (x.counterexamples ?? [])
    .filter((ce) => ce.breaks.split("・").some((b) => same(b, cond)))
    .map((ce) => ({ x, ce, item: ("catalog" in x ? x.catalog ?? [] : []).flatMap((g) => g.items).find((it) => it.open === `break:${ce.id}`) })));   // 問いの一覧は式で決まる分布の実験室だけが持つ
  const moments = (c.formulas ?? []).slice(1).filter((f) => f.label === "期待値" || f.label === "分散");
  const firstLab = exps[0];

  return (
    <div className={s.page} data-testid="bone">
      <div className={s.head}>
        <button type="button" className={s.back} aria-label="戻る" onClick={onBack}>←</button>
        <div className={s.titles}><h2>{c.name}の成り立ち</h2><span className={s.sub}>何がそろうと{c.name}になるか</span></div>
      </div>
      <div className={s.body}>
        {/* 頭：概念と式。骨はここへ向かって集まる */}
        <div className={s.fish} data-testid="bone-head">
          <span className={s.label}>{c.category}</span>
          <b className={s.name}>{c.name}</b>
          {main && <div className={s.tex} dangerouslySetInnerHTML={tex(main.tex, true)} />}
          {c.short && <p className={s.short}>{c.short}</p>}
        </div>
        <div className={s.spine}>
          {params.length > 0 && (
            <section className={s.bone} data-testid="bone-material">
              <h3 className={s.boneTitle}>材料（式の記号）</h3>
              <ul className={s.ribs}>
                {params.map((p) => (
                  <li key={p.key} className={s.rib}>
                    <span className={s.sym} dangerouslySetInnerHTML={tex(p.symbol)} />
                    <span className={s.ribText}><b>{p.meaning}</b>{p.range && <small>{p.range}</small>}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {premises.length > 0 && (
            <section className={s.bone} data-testid="bone-premise">
              <h3 className={s.boneTitle}>前提の概念</h3>
              <ul className={s.ribs}>
                {premises.map((r) => (
                  <li key={r.id}>
                    <a className={`${s.rib} ${s.link}`} href={href({ c: r.from, bone: "1" })}>
                      <span className={s.ribText}><b>{nameOf(net, r.from)}<em className={s.kind}>{r.type}</em></b><small>{r.description}</small></span>
                      <span className={s.chev} aria-hidden>›</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {(c.conditions?.math?.length ?? 0) > 0 && (
            <section className={s.bone} data-testid="bone-conditions">
              <h3 className={s.boneTitle}>成り立つ条件</h3>
              <ul className={s.ribs}>
                {c.conditions!.math.map((cond) => {
                  const bs = breaks(cond);
                  return (
                    <li key={cond} className={s.cond}>
                      <b className={s.condText}>{cond}</b>
                      {bs.length ? bs.map(({ x, ce, item }) => (
                        <div key={ce.id} className={s.broken}>
                          <span className={s.label}>崩すと：{ce.name}</span>
                          <Lead text={ce.text} />
                          <div className={s.actions}>
                            {item && <a className={s.lab} href={href({ x: x.id, q: item.id })}><span className={s.labTag}>実験</span>{item.title}</a>}
                            {ce.concept && ce.concept !== c.id && <a className={s.lab} href={href({ c: ce.concept })}>{nameOf(net, ce.concept)}へ</a>}
                          </div>
                        </div>
                      )) : <small className={s.none}>崩す実験はまだない</small>}
                    </li>
                  );
                })}
              </ul>
              {c.conditions?.data?.length ? <p className={s.note}><span className={s.label}>データに当てはめるとき</span>{c.conditions.data.join("／")}</p> : null}
            </section>
          )}
          {der.length > 0 && (
            <section className={s.bone} data-testid="bone-derivation">
              <h3 className={s.boneTitle}>平均と分散（導出）</h3>
              {der.map((d) => (
                <div key={d.id} className={s.der}>
                  <p className={s.derFrom}>{d.premises.map((p) => nameOf(net, p)).join("・")} から</p>
                  {moments.map((f) => <div key={f.tex} className={s.tex} dangerouslySetInnerHTML={tex(f.tex, true)} />)}
                  {d.conditions.map((t) => <small key={t} className={s.derNote}>{t}</small>)}
                </div>
              ))}
            </section>
          )}
        </div>
      </div>
      {firstLab && (
        <div className={s.bar}>
          <Button variant="primary" className={s.cta} onClick={() => { location.href = href({ x: firstLab.id }); }} data-testid="bone-cta">条件を崩して確かめる</Button>
        </div>
      )}
    </div>
  );
}
