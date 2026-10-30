// 選んだ概念の説明：定義・原理・式（記号の意味）・条件・例・反例・誤解・つながり・単元・出典。
import RelationCard, { Media } from "./Relation";
import { Button, Card, Formula, Muted, Row, Stack } from "@math-lab/ui";
import st from "./Detail.module.css";
import { KINDS, MODES, PREMISES, around, type Concept, type Network, type Relation } from "./data";

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
};

export default function Detail({ net, concept: c, tracing, inCompare, onTrace, onCompare, onSelect }: Props) {
  const { relations, derivations } = around(net, c.id);
  const units = c.units.map((u) => net.units.get(u)).filter((u) => !!u);
  return (
    <Card data-testid="detail">
      <header className={st.head}>
        <h2>{c.name}</h2>
        <Muted>{c.en}{c.en ? "　" : ""}{c.id}・版 {c.version}{c.status === "stub" ? "・まだ説明がない" : ""}</Muted>
        <Row>
          <Button onClick={onTrace} pressed={tracing}>{tracing ? "前提の表示をやめる" : "前提をさかのぼる"}</Button>
          <Button onClick={onCompare} pressed={inCompare}>{inCompare ? "比べるから外す" : "比べるに入れる"}</Button>
        </Row>
      </header>
      {c.definition && <><h3>定義</h3><p>{c.definition}</p></>}
      <Media figures={c.figures} labs={c.labs} context="concept" open />
      {c.principle && <><h3>原理</h3><p>{c.principle}</p></>}
      {c.formulas?.length ? <>
        <h3>式</h3>
        {c.formulas.map((f, i) => (
          <Formula key={i} formula={{ ...f, symbols: f.symbols?.flatMap((x) => (x.key ? [{ ...x, key: x.key }] : [])) }} editable onConcept={(id) => net.concepts.has(id) && onSelect(id)} conceptName={(id) => name(net, id)}
            definitions={(id) => (net.concepts.get(id)?.formulas ?? []).map((g) => ({ ...g, symbols: g.symbols?.flatMap((x) => (x.key ? [{ ...x, key: x.key }] : [])) }))} />
        ))}
        <Muted>記号を押すと意味が出る。「開く」でその記号の定義の式に置き換わる。値を入れると1段ずつ計算できる。</Muted>
      </> : null}
      {c.conditions && <>
        <h3>成り立つ条件</h3>
        <ul>{c.conditions.math.map((x) => <li key={x}>{x}</li>)}</ul>
        {c.conditions.data?.length ? <><h4>データに当てはめるとき</h4><ul>{c.conditions.data.map((x) => <li key={x}>{x}</li>)}</ul></> : null}
      </>}
      {c.example && <><h3>具体例</h3><p>{c.example}</p></>}
      {c.counterexample && <><h3>反例</h3><p>{c.counterexample}</p><Media labs={c.counterexample_labs} context="counterexample" /></>}
      {c.misconceptions?.length ? <>
        <h3>よくある誤解</h3>
        <ul className={st.misconceptions}>{c.misconceptions.map((m, i) => (
          <li key={m.misconception}><Card as="div" tone="inset"><span className={st.wrong}>✕ {m.misconception}</span><p>→ {m.correction}</p><Media labs={m.labs} context={`misconception-${i}`} /></Card></li>))}</ul>
      </> : null}
      {relations.length ? <>
        <h3>つながり</h3>
        <Stack className={st.relations}>{relations.map((r) => (
          <RelationCard key={r.id} net={net} r={r} context={`relation-${r.id}`} onTitle={() => onSelect(r.from === c.id ? r.to : r.from)} />
        ))}</Stack>
      </> : null}
      {derivations.map((d) => (
        <div key={d.id} className={st.derivation}>
          <h3>導出：{d.statement}</h3>
          <Muted>前提：{d.premises.map((p) => name(net, p)).join("・")}</Muted>
          <ol>{d.steps.map((s) => <li key={s}>{s}</li>)}</ol>
          <Muted>条件：{d.conditions.join("／")}</Muted>
        </div>
      ))}
      {units.length ? <>
        <h3>教材で学ぶ</h3>
        <ul>{units.map((u) => <li key={u!.id}>{u!.url ? <a href={u!.url} target="_blank" rel="noreferrer">{u!.number}｜{u!.title} ↗</a> : `${u!.number}｜${u!.title}`}</li>)}</ul>
      </> : null}
      {c.problems.length ? <><h3>確かめる問題</h3><p>{c.problems.join("・")}</p></> : null}
      {c.sources?.length ? <Muted>出典：{c.sources.map((s) => (s.url ? <a key={s.title} href={s.url} target="_blank" rel="noreferrer">{s.title}</a> : s.title))}{c.sources[0].locator ? `（${c.sources[0].locator}）` : ""}</Muted> : null}
    </Card>
  );
}
