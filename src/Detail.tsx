// 選んだ概念の説明：定義・原理・式（記号の意味）・条件・例・反例・誤解・つながり・単元・出典。
import katex from "katex";
import LabLaunch from "./Lab";
import Figures from "./Figure";
import { KINDS, MODES, PREMISES, around, type Concept, type Network, type Relation } from "./data";

function Tex({ tex }: { tex: string }) {
  let html: string;
  try { html = katex.renderToString(tex, { displayMode: true, throwOnError: false, output: "html" }); }
  catch { html = tex; }
  return <div className="tex" dangerouslySetInnerHTML={{ __html: html }} />;
}

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
    <section className="detail" data-testid="detail">
      <header>
        <h2>{c.name}</h2>
        <p className="mute">{c.en}{c.en ? "　" : ""}{c.id}・版 {c.version}{c.status === "stub" ? "・まだ説明がない" : ""}</p>
        <div className="actions">
          <button onClick={onTrace} aria-pressed={tracing}>{tracing ? "前提の表示をやめる" : "前提をさかのぼる"}</button>
          <button onClick={onCompare} aria-pressed={inCompare}>{inCompare ? "比べるから外す" : "比べるに入れる"}</button>
        </div>
      </header>
      {c.definition && <><h3>定義</h3><p>{c.definition}</p></>}
      <Figures figures={c.figures} context="concept" />
      <LabLaunch labs={c.labs} context="concept" />
      {c.principle && <><h3>原理</h3><p>{c.principle}</p></>}
      {c.formulas?.map((f, i) => (
        <div key={i} className="formula">
          {f.label && <h4>{f.label}</h4>}
          <Tex tex={f.tex} />
          {f.symbols?.length ? (
            <table><thead><tr><th>記号</th><th>意味</th><th>範囲</th></tr></thead>
              <tbody>{f.symbols.map((s) => <tr key={s.symbol}><td>{s.symbol}</td><td>{s.meaning}</td><td>{s.range ?? ""}</td></tr>)}</tbody></table>
          ) : null}
        </div>
      ))}
      {c.conditions && <>
        <h3>成り立つ条件</h3>
        <ul>{c.conditions.math.map((x) => <li key={x}>{x}</li>)}</ul>
        {c.conditions.data?.length ? <><h4>データに当てはめるとき</h4><ul>{c.conditions.data.map((x) => <li key={x}>{x}</li>)}</ul></> : null}
      </>}
      {c.example && <><h3>具体例</h3><p>{c.example}</p></>}
      {c.counterexample && <><h3>反例</h3><p>{c.counterexample}</p><LabLaunch labs={c.counterexample_labs} context="counterexample" /></>}
      {c.misconceptions?.length ? <>
        <h3>よくある誤解</h3>
        <ul>{c.misconceptions.map((m, i) => <li key={m.misconception}><b>✕ {m.misconception}</b><br />→ {m.correction}<LabLaunch labs={m.labs} context={`misconception-${i}`} /></li>)}</ul>
      </> : null}
      {relations.length ? <>
        <h3>つながり</h3>
        <ul className="links">{relations.map((r) => {
          const other = r.from === c.id ? r.to : r.from;
          return (
            <li key={r.id}>
              <button className="link" onClick={() => onSelect(other)}>{sentence(net, r)}</button>
              {r.gist && <div className="gist">💡 <b>つまり</b>　{r.gist}</div>}
              <div className="mute">{r.description}{r.conditions?.length ? `　条件：${r.conditions.join("／")}` : ""}</div>
              <Figures figures={r.figures} context={`relation-${r.id}`} folded />
              <LabLaunch labs={r.labs} context={`relation-${r.id}`} />
            </li>);
        })}</ul>
      </> : null}
      {derivations.map((d) => (
        <div key={d.id} className="derivation">
          <h3>導出：{d.statement}</h3>
          <p className="mute">前提：{d.premises.map((p) => name(net, p)).join("・")}</p>
          <ol>{d.steps.map((s) => <li key={s}>{s}</li>)}</ol>
          <p className="mute">条件：{d.conditions.join("／")}</p>
        </div>
      ))}
      {units.length ? <>
        <h3>教材で学ぶ</h3>
        <ul>{units.map((u) => <li key={u!.id}>{u!.url ? <a href={u!.url} target="_blank" rel="noreferrer">{u!.number}｜{u!.title} ↗</a> : `${u!.number}｜${u!.title}`}</li>)}</ul>
      </> : null}
      {c.problems.length ? <><h3>確かめる問題</h3><p>{c.problems.join("・")}</p></> : null}
      {c.sources?.length ? <p className="mute">出典：{c.sources.map((s) => (s.url ? <a key={s.title} href={s.url} target="_blank" rel="noreferrer">{s.title}</a> : s.title))}{c.sources[0].locator ? `（${c.sources[0].locator}）` : ""}</p> : null}
    </section>
  );
}
