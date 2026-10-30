// 選んだ概念の説明：定義・原理・式（記号の意味）・条件・例・反例・誤解・つながり・単元・出典。
import { useState } from "react";
import { Badges, Media, relationParts } from "./Relation";
import { Button, Card, Disclosure, Formula, Muted, Row, Segmented, Workspace } from "@math-lab/ui";
import st from "./Detail.module.css";
import { KINDS, MODES, PREMISES, around, type Concept, type Formula as NetFormula, type Network, type Relation } from "./data";

/** 画面の型（key が任意）から部品の型へ（key のない記号は木から指せないので落とす） */
const keyed = (f: NetFormula) => ({ ...f, symbols: f.symbols?.flatMap((x) => (x.key ? [{ ...x, key: x.key }] : [])) });

export function name(net: Network, id: string): string {
  return net.concepts.get(id)?.name ?? id;
}

/** 関係を「□は■の前提」のような文にする。 */
export function sentence(net: Network, r: Relation): string {
  const k = KINDS[r.type];
  const s = (k?.reading ?? `□ → ■（${r.type}）`).replace("□", name(net, r.from)).replace("■", name(net, r.to));
  const tag = r.mode ? `（${MODES[r.mode]}）` : r.premise ? `（${PREMISES[r.premise]}）` : "";
  return s + tag;
}

type Props = {
  net: Network; concept: Concept; tracing: boolean; inCompare: boolean;
  onTrace: () => void; onCompare: () => void; onSelect: (id: string) => void;
  /** つながりの行を押す（線を押したのと同じ。下からシートが開く） */
  onEdge: (id: string) => void; edgeSel?: string | null;
};

type Tab = "main" | "rel" | "more";

export default function Detail({ net, concept: c, tracing, inCompare, onTrace, onCompare, onSelect, onEdge, edgeSel }: Props) {
  const { relations, derivations } = around(net, c.id);
  const units = c.units.map((u) => net.units.get(u)).filter((u) => !!u);
  // 縦に長くならないよう、定義の下を「動かす（または説明）｜つながり｜くわしく」に分けて1つだけ出す
  const [tab, setTab] = useState<Tab>("main");
  // くわしく：項目ごとに開閉する（見出しだけ並べ、読みたい所だけ開く）。作業台のない概念では「説明」に全部開いて出す
  const sec = (id: string, title: string, node: React.ReactNode, open: boolean) =>
    c.workspace ? <Disclosure key={id} summary={title} data-testid={`more-${id}`} open={open}>{node}</Disclosure> : <div key={id}><h3>{title}</h3>{node}</div>;
  const body = <>
      {c.principle && sec("principle", "原理", <p>{c.principle}</p>, true)}
      {c.formulas?.length ? sec("formulas", `式（${c.formulas.length}）`, <>
        {c.formulas.map((f, i) => (
          <Formula key={i} formula={keyed(f)} editable onConcept={(id) => net.concepts.has(id) && onSelect(id)} conceptName={(id) => name(net, id)}
            definitions={(id) => (net.concepts.get(id)?.formulas ?? []).map(keyed)} />
        ))}
        <Muted>記号を押すと意味が出る。「開く」でその記号の定義の式に置き換わる。値を入れると1段ずつ計算できる。</Muted>
      </>, false) : null}
      {c.conditions && sec("conditions", "成り立つ条件", <>
        <ul>{c.conditions.math.map((x) => <li key={x}>{x}</li>)}</ul>
        {c.conditions.data?.length ? <><h4>データに当てはめるとき</h4><ul>{c.conditions.data.map((x) => <li key={x}>{x}</li>)}</ul></> : null}
      </>, false)}
      {(c.example || c.counterexample) && sec("examples", "具体例と反例", <>
        {c.example && <p><b>例</b>　{c.example}</p>}
        {c.counterexample && <><p><b>反例</b>　{c.counterexample}</p><Media labs={c.counterexample_labs} context="counterexample" /></>}
      </>, false)}
      {c.misconceptions?.length ? sec("misconceptions", `よくある誤解（${c.misconceptions.length}）`,
        <ul className={st.misconceptions}>{c.misconceptions.map((m, i) => (
          <li key={m.misconception}><Card as="div" tone="inset"><span className={st.wrong}>✕ {m.misconception}</span><p>→ {m.correction}</p><Media labs={m.labs} context={`misconception-${i}`} /></Card></li>))}</ul>, false) : null}
  </>;
  return (
    <Card data-testid="detail">
      <header className={st.head}>
        <h2>{c.name}</h2>
        <Muted>{c.en}{c.en ? "　" : ""}{c.id}・版 {c.version}{c.status === "stub" ? "・まだ説明がない" : ""}</Muted>
        <Row>
          <Button onClick={onTrace} pressed={tracing}>{tracing ? "前提の表示をやめる" : "前提をさかのぼる"}</Button>
          <Button onClick={onCompare} pressed={inCompare}>ほかの概念と比べる</Button>
        </Row>
      </header>
      {c.definition && <p className={st.definition}>{c.definition}</p>}
      <div className={st.tabs}>
        <Segmented value={tab} onChange={(v) => v && setTab(v as Tab)} label="概念の中身"
          items={[
            { value: "main", label: c.workspace ? "動かす" : "説明" },
            { value: "rel", label: <>つながり <span className={st.n}>{relations.length + derivations.length}</span></> },
            { value: "more", label: "くわしく" },
          ]} />
      </div>
      {tab === "main" && <div className={st.pane} data-testid="tab-main">
        {c.workspace && c.formulas?.[c.workspace.formula]?.tree && (
          <Workspace formula={keyed(c.formulas[c.workspace.formula]!)} mean={c.workspace.mean !== undefined ? keyed(c.formulas[c.workspace.mean]!) : undefined}
            vary={c.workspace.vary} over={c.workspace.over} definitions={(id) => (net.concepts.get(id)?.formulas ?? []).map(keyed)}
            onConcept={(id) => net.concepts.has(id) && onSelect(id)} conceptName={(id) => name(net, id)} />
        )}
        <Media figures={c.figures} labs={c.labs} context="concept" open={!c.workspace} />
        {!c.workspace && body}
      </div>}
      {tab === "rel" && <div className={st.pane} data-testid="tab-rel">
        {relations.length + derivations.length ? (
          <ul className={st.rels} data-testid="edge-list">
            {relations.map((r) => (
              <li key={r.id} data-testid={`rel-${r.id}`}>
                <button type="button" className={st.rel} aria-pressed={edgeSel === r.id} onClick={() => onEdge(r.id)}>
                  <Badges net={net} r={r} />
                  <span className={st.relText}>{relationParts(net, r).text}</span>
                  {r.gist && <span className={st.relGist}>{r.gist}</span>}
                </button>
              </li>
            ))}
            {derivations.map((d) => (
              <li key={d.id} data-testid={`der-${d.id}`}>
                <button type="button" className={st.rel} aria-pressed={edgeSel === d.id} onClick={() => onEdge(d.id)}>
                  <span className={st.derTag}>導出</span>
                  <span className={st.relText}>{d.statement}</span>
                  <span className={st.relGist}>前提：{d.premises.map((p) => name(net, p)).join("・")}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : <Muted>まだつながりがない。</Muted>}
        <Muted>押すと、下から説明（図・解説・触る）が開く。グラフの線を押すのと同じ。</Muted>
      </div>}
      {tab === "more" && <div className={st.pane} data-testid="tab-more">
        {c.workspace ? body : null}
        {units.length ? <>
          <h3>教材で学ぶ</h3>
          <ul>{units.map((u) => <li key={u!.id}>{u!.url ? <a href={u!.url} target="_blank" rel="noreferrer">{u!.number}｜{u!.title} ↗</a> : `${u!.number}｜${u!.title}`}</li>)}</ul>
        </> : null}
        {c.problems.length ? <><h3>確かめる問題（{c.problems.length}）</h3><p className={st.problems}>{c.problems.map((q) => <span key={q}>{q.replace(/^[\w-]+:Q-/, "")}</span>)}</p></> : null}
        {c.sources?.length ? <Muted>出典：{c.sources.map((s) => (s.url ? <a key={s.title} href={s.url} target="_blank" rel="noreferrer">{s.title}</a> : s.title))}{c.sources[0].locator ? `（${c.sources[0].locator}）` : ""}</Muted> : null}
        {!c.workspace && !units.length && !c.problems.length && !c.sources?.length ? <Muted>教材・問題・出典はまだない。</Muted> : null}
      </div>}
    </Card>
  );
}
