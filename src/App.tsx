// 画面全体。状態は URL に持つ（?c=選んだ概念&view=around|all&cmp=比べる概念&trace=1&embed=1&src=データ）。
// 概念を選ぶたびに履歴に積む（ブラウザの「戻る」で前の概念・表示に戻る）。
// c を付けて開いたとき（Notion の 🕸 リンク）は、その概念の周辺図から始める。
// Notion の埋め込み（高さ約320px）では embed=1：選んだ概念の周辺図と、短い説明と「大きく開く ↗」。
import { useEffect, useMemo, useRef, useState } from "react";
import Detail, { name, sentence } from "./Detail";
import Graph, { TYPE_COLOR } from "./Graph";
import Panel from "./Panel";
import { Badges, relationParts } from "./Relation";
import { Button, Card, Disclosure, ErrorText, Field, Muted, Split } from "./ui";
import st from "./App.module.css";
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
  if (!net) return <main className={st.app}><Muted>読み込み中…</Muted>{errors.map((e) => <ErrorText key={e}>{e}</ErrorText>)}</main>;
  const concept = sel ? net.concepts.get(sel) : undefined;
  const hits = query ? [...net.concepts.values()].filter((c) => (c.name + (c.en ?? "")).toLowerCase().includes(query.toLowerCase())).slice(0, 8) : [];
  const toggleCmp = (id: string) => setCmp(cmp.includes(id) ? cmp.filter((x) => x !== id) : [...cmp, id].slice(-3));

  if (EMBED) {
    const full = `${location.pathname}?${new URLSearchParams({ ...(sel ? { c: sel } : {}), ...(SRC ? { src: SRC } : {}) }).toString()}`;
    return (
      <main className={st.embed}>
        <Graph net={net} selected={sel} highlight={highlight} hidden={hidden} positions={positions} onSelect={setSel} fill />
        <div className={st.embedCard} data-testid="embed-card">
          <b>{concept ? concept.name : "知識ネットワーク"}</b>
          <Muted className={st.clamp}>{concept?.definition ?? "概念を押すと説明が出る"}</Muted>
          <a href={full} target="_blank" rel="noreferrer">大きく開く ↗</a>
        </div>
      </main>
    );
  }

  const cmpData = cmp.length >= 2 ? compare(net, cmp) : null;
  return (
    <main className={`${st.app}${edgeSel ? ` ${st.withSheet} has-panel` : ""}`}>
      <header className={st.top}>
        <h1>知識ネットワーク</h1>
        <Muted>{net.courses.map((c) => c.title).join("・")}　概念 {[...net.concepts.values()].filter((c) => c.status === "filled").length}・関係 {net.relations.length}・導出 {net.derivations.length}</Muted>
        <Field type="search" placeholder="概念を探す（名前・英語名）" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="概念を探す" />
        {hits.length ? <ul className={st.hits}>{hits.map((c) => <li key={c.id}><Button onClick={() => { setSel(c.id); setQuery(""); }}>{c.name}</Button></li>)}</ul> : null}
      </header>
      {errors.map((e) => <ErrorText key={e}>{e}</ErrorText>)}
      {sel ? (
        <Split className={st.views} role="group" aria-label="表示">
          <Button pressed={view === "around"} onClick={() => setView("around")}>まわり</Button>
          <Button pressed={view === "all"} onClick={() => setView("all")}>全体</Button>
        </Split>
      ) : null}
      <Graph net={net} selected={sel} highlight={highlight} hidden={hidden} positions={positions}
        onSelect={setSel} onEdge={setEdgeSel} edgeSel={edgeSel} />
      {concept ? (() => {
        const a = around(net, concept.id);
        const items = [...a.relations.map((r) => ({ id: r.id, text: relationParts(net, r).text, rel: r })), ...a.derivations.map((d) => ({ id: d.id, text: `導出：${d.statement}`, rel: undefined }))];
        return items.length ? (
          <Disclosure data-testid="edge-list" open={view === "around"} summary={<>つながり一覧（{items.length}）<Muted as="span">線を押すのと同じ</Muted></>}>
            <ul className={st.edges}>{items.map((it) => <li key={it.id}><Button block className={st.chip} pressed={edgeSel === it.id} onClick={() => setEdgeSel(it.id)}>{it.rel && <Badges net={net} r={it.rel} />}<span>{it.text}</span></Button></li>)}</ul>
          </Disclosure>
        ) : null;
      })() : null}
      <Disclosure summary="関係の種類（押すと表示を切り替える）">
        <Muted>矢印の向きは A → B。線の名前は、概念を選ぶとその線にだけ出る。</Muted>
        <ul className={st.kinds}>{Object.entries(KINDS).map(([t, k]) => (
          <li key={t}>
            <label>
              <input type="checkbox" checked={!hidden.has(t)} onChange={() => { const h = new Set(hidden); if (h.has(t)) h.delete(t); else h.add(t); setHidden(h); }} />
              <span className={st.swatch} style={{ background: `var(${TYPE_COLOR[t]})` }} /> <b>{t}</b>　{k.reading.replace("□", "A").replace("■", "B")}
            </label>
            <Muted as="div">{k.definition}</Muted>
          </li>))}
        </ul>
        <Muted>変換の線：実線＝{MODES.exact}、破線＝{MODES.approximation}、点線＝{MODES.limit}。点線の枠＝まだ説明がない概念。</Muted>
      </Disclosure>
      {tr && concept ? (
        <Card data-testid="trace">
          <h3>{concept.name} の前提（近い順）</h3>
          {tr.order.length ? <ol>{tr.order.map((id) => <li key={id}><Button variant="link" onClick={() => setSel(id)}>{name(net, id)}</Button></li>)}</ol> : <Muted>たどれる前提はない</Muted>}
        </Card>
      ) : null}
      {concept ? <Detail net={net} concept={concept} tracing={tracing} inCompare={cmp.includes(concept.id)}
        onTrace={() => setTracing(!tracing)} onCompare={() => toggleCmp(concept.id)} onSelect={setSel} /> :
        <Card><Muted>概念を押すと、定義・式・条件・つながり・教材へのリンクが出る。</Muted></Card>}
      {cmp.length ? (
        <Card data-testid="compare">
          <h3>比べる：{cmp.map((id) => name(net, id)).join(" と ")}</h3>
          {cmpData ? <>
            {cmpData.rows.map((r) => (
              <div key={r.label} className={st.compareRow}>
                <h4>{r.label}</h4>
                {r.values.map((v, i) => <p key={i}><b>{cmpData.concepts[i].name}</b>：{v || "—"}</p>)}
              </div>))}
            {cmpData.between.length ? <div className={st.compareRow}><h4>この組の関係</h4>{cmpData.between.map((r) => <p key={r.id}>{sentence(net, r)}：{r.description}</p>)}</div> : null}
            {cmpData.common.length ? <div className={st.compareRow}><h4>共通の前提</h4><p>{cmpData.common.map((id) => name(net, id)).join("・")}</p></div> : null}
          </> : <Muted>もう1つ選んで「比べるに入れる」を押す（3つまで）。</Muted>}
          <Button onClick={() => setCmp([])}>比べるを空にする</Button>
        </Card>
      ) : null}
      {edgeSel ? <Panel net={net} edgeId={edgeSel} onClose={() => setEdgeSel(null)} onSelect={(id) => setSel(id)} /> : null}
      <Muted as="div" className={st.footer}>データ：各教材の公開した JSON（型 kn-schema v1）。教材の原本は各教材のリポジトリ。</Muted>
    </main>
  );
}
