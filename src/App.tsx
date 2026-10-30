// 画面全体。状態は URL に持つ（?c=選んだ概念&view=around|all&cmp=比べる概念&trace=1&embed=1&src=データ）。
// 概念を選ぶたびに履歴に積む（ブラウザの「戻る」で前の概念・表示に戻る）。
// c を付けて開いたとき（Notion の 🕸 リンク）は、その概念の周辺図から始める。
// Notion の埋め込み（高さ約320px）では embed=1：選んだ概念の周辺図と、短い説明と「大きく開く ↗」。
import { useEffect, useMemo, useRef, useState } from "react";
import Detail, { name, sentence } from "./Detail";
import Graph, { TYPE_COLOR } from "./Graph";
import Panel from "./Panel";
import { Badges, relationParts } from "./Relation";
import { KINDS, MODES, around, compare, load, neighborhood, trace, type Network } from "./data";

const params = new URLSearchParams(location.search);
const EMBED = params.get("embed") === "1";
const SRC = params.get("src");

type View = "around" | "all";
const readView = (p: URLSearchParams): View => (p.get("view") === "all" ? "all" : p.get("view") === "around" || p.get("c") ? "around" : "all");

function useUrlState() {
  const [sel, setSelRaw] = useState<string | null>(params.get("c"));
  const [view, setView] = useState<View>(readView(params));
  const [cmp, setCmp] = useState<string[]>((params.get("cmp") ?? "").split(",").filter(Boolean));
  const [tracing, setTracing] = useState(params.get("trace") === "1");
  const push = useRef(false);
  const setSel = (id: string | null) => { push.current = true; setSelRaw(id); };
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    const set = (k: string, v: string | null) => (v ? p.set(k, v) : p.delete(k));
    set("c", sel); set("view", sel ? view : null); set("cmp", cmp.join(",") || null); set("trace", tracing ? "1" : null);
    const url = `${location.pathname}?${p.toString()}`.replace(/\?$/, "");
    if (url === `${location.pathname}${location.search}`) return;
    if (push.current) history.pushState(null, "", url); else history.replaceState(null, "", url);
    push.current = false;
  }, [sel, view, cmp, tracing]);
  useEffect(() => {   // 「戻る」：URL から選んだ概念と表示を戻す
    const back = () => { const p = new URLSearchParams(location.search); setSelRaw(p.get("c")); setView(readView(p)); };
    addEventListener("popstate", back);
    return () => removeEventListener("popstate", back);
  }, []);
  return { sel, setSel, view, setView, cmp, setCmp, tracing, setTracing };
}

export default function App() {
  const [net, setNet] = useState<Network | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const { sel, setSel, view, setView, cmp, setCmp, tracing, setTracing } = useUrlState();
  const [edgeSel, setEdgeSel] = useState<string | null>(null);
  useEffect(() => setEdgeSel(null), [sel]);   // 別の概念へ進んだら、線の説明は閉じる

  useEffect(() => { load(SRC).then((r) => { setNet(r.net); setErrors(r.errors); }); }, []);

  const tr = useMemo(() => (net && sel && tracing ? trace(net, sel) : null), [net, sel, tracing]);
  const highlight = useMemo(() => {
    if (!tr || !sel) return new Set<string>();
    const ids = new Set<string>([sel, ...tr.order]);
    for (const s of tr.steps) {
      const r = net!.relations.find((x) => x.from === s.from && x.to === s.to && x.type === s.via);
      if (r) ids.add(r.id);
      else { ids.add(s.via); ids.add(`${s.via}>${s.from}`); ids.add(`${s.via}>>`); }
    }
    return ids;
  }, [tr, sel, net]);
  const positions = useMemo(() => (net && sel && (view === "around" || EMBED) && net.concepts.has(sel) ? neighborhood(net, sel) : undefined), [net, sel, view]);
  if (!net) return <main className="app"><p className="mute">読み込み中…</p>{errors.map((e) => <p key={e} className="error">{e}</p>)}</main>;
  const concept = sel ? net.concepts.get(sel) : undefined;
  const hits = query ? [...net.concepts.values()].filter((c) => (c.name + (c.en ?? "")).toLowerCase().includes(query.toLowerCase())).slice(0, 8) : [];
  const toggleCmp = (id: string) => setCmp(cmp.includes(id) ? cmp.filter((x) => x !== id) : [...cmp, id].slice(-3));

  if (EMBED) {
    const full = `${location.pathname}?${new URLSearchParams({ ...(sel ? { c: sel } : {}), ...(SRC ? { src: SRC } : {}) }).toString()}`;
    return (
      <main className="app embed">
        <Graph net={net} selected={sel} highlight={highlight} hidden={hidden} positions={positions} onSelect={setSel} fill />
        <div className="embed-card" data-testid="embed-card">
          <b>{concept ? concept.name : "知識ネットワーク"}</b>
          <span className="mute">{concept?.definition ?? "概念を押すと説明が出る"}</span>
          <a href={full} target="_blank" rel="noreferrer">大きく開く ↗</a>
        </div>
      </main>
    );
  }

  const cmpData = cmp.length >= 2 ? compare(net, cmp) : null;
  return (
    <main className={`app${edgeSel ? " has-panel" : ""}`}>
      <header className="top">
        <h1>知識ネットワーク</h1>
        <p className="mute">{net.courses.map((c) => c.title).join("・")}　概念 {[...net.concepts.values()].filter((c) => c.status === "filled").length}・関係 {net.relations.length}・導出 {net.derivations.length}</p>
        <input type="search" placeholder="概念を探す（名前・英語名）" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="概念を探す" />
        {hits.length ? <ul className="hits">{hits.map((c) => <li key={c.id}><button onClick={() => { setSel(c.id); setQuery(""); }}>{c.name}</button></li>)}</ul> : null}
      </header>
      {errors.map((e) => <p key={e} className="error" role="alert">{e}</p>)}
      {sel ? (
        <div className="views" role="group" aria-label="表示">
          <button aria-pressed={view === "around"} onClick={() => setView("around")}>まわり</button>
          <button aria-pressed={view === "all"} onClick={() => setView("all")}>全体</button>
        </div>
      ) : null}
      <Graph net={net} selected={sel} highlight={highlight} hidden={hidden} positions={positions}
        onSelect={setSel} onEdge={setEdgeSel} edgeSel={edgeSel} />
      {concept ? (() => {
        const a = around(net, concept.id);
        const items = [...a.relations.map((r) => ({ id: r.id, text: relationParts(net, r).text, rel: r })), ...a.derivations.map((d) => ({ id: d.id, text: `導出：${d.statement}`, rel: undefined }))];
        return items.length ? (
          <details className="edges" data-testid="edge-list" open={view === "around"}>
            <summary>つながり一覧（{items.length}）　線を押すのと同じ</summary>
            <ul>{items.map((it) => <li key={it.id}><button className="chip" aria-pressed={edgeSel === it.id} onClick={() => setEdgeSel(it.id)}>{it.rel && <Badges net={net} r={it.rel} />}<span>{it.text}</span></button></li>)}</ul>
          </details>
        ) : null;
      })() : null}
      <details className="legend">
        <summary>関係の種類（押すと表示を切り替える）</summary>
        <p className="mute">矢印の向きは A → B。線の名前は、概念を選ぶとその線にだけ出る。</p>
        <ul>{Object.entries(KINDS).map(([t, k]) => (
          <li key={t}>
            <label>
              <input type="checkbox" checked={!hidden.has(t)} onChange={() => { const h = new Set(hidden); if (h.has(t)) h.delete(t); else h.add(t); setHidden(h); }} />
              <span className="swatch" style={{ background: `var(${TYPE_COLOR[t]})` }} /> <b>{t}</b>　{k.reading.replace("□", "A").replace("■", "B")}
            </label>
            <div className="mute">{k.definition}</div>
          </li>))}
        </ul>
        <p className="mute">変換の線：実線＝{MODES.exact}、破線＝{MODES.approximation}、点線＝{MODES.limit}。点線の枠＝まだ説明がない概念。</p>
      </details>
      {tr && concept ? (
        <section className="trace" data-testid="trace">
          <h3>{concept.name} の前提（近い順）</h3>
          {tr.order.length ? <ol>{tr.order.map((id) => <li key={id}><button className="link" onClick={() => setSel(id)}>{name(net, id)}</button></li>)}</ol> : <p className="mute">たどれる前提はない</p>}
        </section>
      ) : null}
      {concept ? <Detail net={net} concept={concept} tracing={tracing} inCompare={cmp.includes(concept.id)}
        onTrace={() => setTracing(!tracing)} onCompare={() => toggleCmp(concept.id)} onSelect={setSel} /> :
        <p className="mute hint">概念を押すと、定義・式・条件・つながり・教材へのリンクが出る。</p>}
      {cmp.length ? (
        <section className="compare" data-testid="compare">
          <h3>比べる：{cmp.map((id) => name(net, id)).join(" と ")}</h3>
          {cmpData ? <>
            {cmpData.rows.map((r) => (
              <div key={r.label} className="row">
                <h4>{r.label}</h4>
                {r.values.map((v, i) => <p key={i}><b>{cmpData.concepts[i].name}</b>：{v || "—"}</p>)}
              </div>))}
            {cmpData.between.length ? <div className="row"><h4>この組の関係</h4>{cmpData.between.map((r) => <p key={r.id}>{sentence(net, r)}：{r.description}</p>)}</div> : null}
            {cmpData.common.length ? <div className="row"><h4>共通の前提</h4><p>{cmpData.common.map((id) => name(net, id)).join("・")}</p></div> : null}
          </> : <p className="mute">もう1つ選んで「比べるに入れる」を押す（3つまで）。</p>}
          <button onClick={() => setCmp([])}>比べるを空にする</button>
        </section>
      ) : null}
      {edgeSel ? <Panel net={net} edgeId={edgeSel} onClose={() => setEdgeSel(null)} onSelect={(id) => setSel(id)} /> : null}
      <footer className="mute">データ：各教材の公開した JSON（型 kn-schema v1）。教材の原本は各教材のリポジトリ。</footer>
    </main>
  );
}
