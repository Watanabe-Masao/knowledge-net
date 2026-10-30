// 画面全体。状態は URL に持つ（?c=選んだ概念&view=around|all&cmp=比べる概念&trace=1&x=実験室&embed=1&src=データ）。
// 概念を選ぶたびに履歴に積む（ブラウザの「戻る」で前の概念・表示に戻る）。
// c を付けて開いたとき（Notion の 🕸 リンク）は、その概念の周辺図から始める。
// Notion の埋め込み（高さ約320px）では embed=1：選んだ概念の周辺図と、短い説明と「大きく開く ↗」。
import { useEffect, useMemo, useRef, useState } from "react";
import Detail, { name, sentence } from "./Detail";
import Graph, { TYPE_COLOR } from "./Graph";
import Panel from "./Panel";
import Search from "./Search";
import { Button, Card, ErrorText, Experiment, FullView, Muted, Sheet } from "@math-lab/ui";
import st from "./App.module.css";
import { KINDS, MODES, around, compare, load, neighborhood, trace, type Network } from "./data";
import { relationParts } from "./Relation";

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
  const [exp, setExpRaw] = useState<string | null>(params.get("x"));
  const push = useRef(false);
  const setSel = (id: string | null) => { push.current = true; setSelRaw(id); setExpRaw(null); };
  const setExp = (id: string | null) => { push.current = true; setExpRaw(id); };
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    const set = (k: string, v: string | null) => (v ? p.set(k, v) : p.delete(k));
    set("c", sel); set("view", sel ? view : null); set("cmp", cmp.join(",") || null); set("trace", tracing ? "1" : null); set("x", exp);
    const url = `${location.pathname}?${p.toString()}`.replace(/\?$/, "");
    if (url === `${location.pathname}${location.search}`) return;
    if (push.current) history.pushState(null, "", url); else history.replaceState(null, "", url);
    push.current = false;
  }, [sel, view, cmp, tracing, exp]);
  useEffect(() => {   // 「戻る」：URL から選んだ概念と表示を戻す
    const back = () => { const p = new URLSearchParams(location.search); setSelRaw(p.get("c")); setView(readView(p)); setExpRaw(p.get("x")); };
    addEventListener("popstate", back);
    return () => removeEventListener("popstate", back);
  }, []);
  return { sel, setSel, view, setView, cmp, setCmp, tracing, setTracing, exp, setExp };
}

export default function App() {
  const [net, setNet] = useState<Network | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const { sel, setSel, view, setView, cmp, setCmp, tracing, setTracing, exp, setExp } = useUrlState();
  // 下から開く面は1つだけ：線の説明（edge）か、線の見方（kinds）・前提（trace）・比べる（compare）
  const [edgeSel, setEdgeRaw] = useState<string | null>(null);
  const [modal, setModalRaw] = useState<"kinds" | "trace" | "compare" | "pick" | null>(null);
  const setEdgeSel = (id: string | null) => { setEdgeRaw(id); if (id) setModalRaw(null); };
  const setModal = (m: typeof modal) => { setModalRaw(m); if (m) setEdgeRaw(null); };
  useEffect(() => setEdgeRaw(null), [sel]);   // 別の概念へ進んだら、線の説明は閉じる
  // ラボを全面で開く：一覧の「大きく開く」と、ラボの中の「大きく開く ↗」（host=kn のときは親に知らせてくる）
  const [full, setFull] = useState<{ url: string; title?: string } | null>(null);
  useEffect(() => {
    const own = (e: Event) => setFull((e as CustomEvent<{ url: string; title?: string }>).detail);
    const msg = (e: MessageEvent) => {
      const d = e.data as { type?: string; url?: string } | null;
      if (d?.type !== "lab:open" || typeof d.url !== "string") return;
      try { if (new URL(d.url).origin !== e.origin) return; } catch { return; }   // ラボ自身の場所のページだけ開く
      setFull({ url: d.url });
    };
    addEventListener("kn:open-lab", own); addEventListener("message", msg);
    return () => { removeEventListener("kn:open-lab", own); removeEventListener("message", msg); };
  }, []);
  useEffect(() => { if (cmp.length >= 2) setModal("compare"); }, [cmp.join(",")]);   // eslint-disable-line react-hooks/exhaustive-deps

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

  // 実験室（?x=）：同じサイトの1ページ。戻ると概念のページへ
  const xdef = exp ? net.experiments.get(exp) : undefined;
  if (xdef) {
    const formulaOf = (id?: string, i = 0) => { const f = id ? net.concepts.get(id)?.formulas?.[i] : undefined; return f ? { ...f, symbols: f.symbols?.flatMap((x) => (x.key ? [{ ...x, key: x.key }] : [])) } : undefined; };
    return (
      <main className={st.app}>
        <Experiment def={xdef} reasonFormula={formulaOf(xdef.reason?.concept, xdef.reason?.formula)} mainFormula={formulaOf(xdef.links.concepts?.[0])}
          onConcept={(id) => net.concepts.has(id) && setSel(id)} conceptName={(id) => name(net, id)}
          onBack={() => (history.length > 1 ? history.back() : setExp(null))}
          definitions={(id) => (net.concepts.get(id)?.formulas ?? []).map((f) => formulaOf(id, (net.concepts.get(id)?.formulas ?? []).indexOf(f))!)}
          workspace={(() => {   // 理由の段に、つなぐ概念の作業台を置く（概念のページと同じもの）
            const cid = xdef.reason?.concept ?? xdef.links.concepts?.[0], c = cid ? net.concepts.get(cid) : undefined, w = c?.workspace;
            const f = w ? formulaOf(cid, w.formula) : undefined;
            return w && f?.tree ? { formula: f, mean: w.mean !== undefined ? formulaOf(cid, w.mean) : undefined, vary: w.vary, over: w.over } : undefined;
          })()} />
      </main>
    );
  }
  const cmpData = cmp.length >= 2 ? compare(net, cmp) : null;
  return (
    <main className={`${st.app}${edgeSel || modal ? ` ${st.withSheet} has-panel` : ""}`}>
      <header className={st.top}>
        <h1>知識ネットワーク</h1>
        <Muted>{net.courses.map((c) => c.title).join("・")}　概念 {[...net.concepts.values()].filter((c) => c.status === "filled").length}・関係 {net.relations.length}・導出 {net.derivations.length}</Muted>
        <Search concepts={[...net.concepts.values()]} onPick={setSel} />
      </header>
      {errors.map((e) => <ErrorText key={e}>{e}</ErrorText>)}
      <Graph net={net} selected={sel} highlight={highlight} hidden={hidden} positions={positions}
        onSelect={setSel} onEdge={setEdgeSel} edgeSel={edgeSel}
        topLeft={sel ? (
          <div className={st.mode} role="group" aria-label="表示">
            <button type="button" aria-pressed={view === "around"} onClick={() => setView("around")}>まわり</button>
            <button type="button" aria-pressed={view === "all"} onClick={() => setView("all")}>全体</button>
          </div>
        ) : null}
        bottomLeft={<>
          <button type="button" className={st.chipBtn} onClick={() => setModal("kinds")}>線の見方{hidden.size ? `・${hidden.size} 種類を隠す` : ""}</button>
          {cmp.length ? <button type="button" className={st.chipBtn} onClick={() => setModal("compare")}>比べる {cmp.length}</button> : null}
        </>} />
      {concept ? <Detail net={net} concept={concept} tracing={tracing} inCompare={cmp.includes(concept.id)}
        onTrace={() => { setTracing(!tracing); setModal(tracing ? null : "trace"); }} onExperiment={setExp} onCompare={() => { if (!cmp.includes(concept.id)) setCmp([concept.id]); setModal("pick"); }} onSelect={setSel} onEdge={setEdgeSel} edgeSel={edgeSel} /> :
        <Card><Muted>概念を押すと、定義・式・条件・つながり・教材へのリンクが出る。</Muted></Card>}
      {modal === "kinds" && (
        <Sheet label="線の見方" title="線の見方" onClose={() => setModal(null)} data-testid="kinds">
          <Muted>矢印の向きは A → B。線の名前は、概念を選ぶとその線にだけ出る。チェックを外すと、その種類の線を隠す。</Muted>
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
        </Sheet>
      )}
      {modal === "trace" && tr && concept && (
        <Sheet label="前提をさかのぼる" title={`${concept.name} の前提`} onClose={() => { setModal(null); setTracing(false); }} data-testid="trace">
          <Muted>近い順。図では前提の道を強調している（閉じると元の表示に戻る）。</Muted>
          {tr.order.length ? <ol>{tr.order.map((id) => <li key={id}><Button variant="link" onClick={() => setSel(id)}>{name(net, id)}</Button></li>)}</ol> : <Muted>たどれる前提はない</Muted>}
        </Sheet>
      )}
      {modal === "pick" && cmp.length ? (() => {
        // 比べる相手を選ぶ：つながりのある概念を先に（どうつながるかの文つき）、ほかは探して選ぶ
        const base = cmp[0]!, a = around(net, base);
        const near = a.relations.map((r) => ({ id: r.from === base ? r.to : r.from, why: relationParts(net, r).text })).filter((x) => !cmp.includes(x.id) && net.concepts.has(x.id))
          .filter((x, i, xs) => xs.findIndex((y) => y.id === x.id) === i);
        const add = (id: string) => setCmp([...cmp, id].slice(0, 3));
        return (
          <Sheet label="比べる相手を選ぶ" title={`${cmp.map((id) => name(net, id)).join("・")} と比べる`} onClose={() => { if (cmp.length >= 2) setModal("compare"); else { setCmp([]); setModal(null); } }} data-testid="pick">
            <Muted>定義・条件・期待値と分散などを同じ並びで比べ、2つの関係と共通の前提を出す。</Muted>
            {near.length ? <>
              <h4>つながりのある概念</h4>
              <ul className={st.pick}>{near.map((x) => (
                <li key={x.id}><button type="button" className={st.pickItem} onClick={() => add(x.id)}><b>{name(net, x.id)}</b><span>{x.why}</span></button></li>
              ))}</ul>
            </> : null}
            <h4>ほかの概念から探す</h4>
            <Search concepts={[...net.concepts.values()].filter((c) => !cmp.includes(c.id))} onPick={add} />
          </Sheet>
        );
      })() : null}
      {modal === "compare" && cmp.length ? (
        <Sheet label="比べる" title={`比べる：${cmp.map((id) => name(net, id)).join(" と ")}`} onClose={() => setModal(null)} data-testid="compare">
          {cmpData ? <>
            {cmpData.rows.map((r) => (
              <div key={r.label} className={st.compareRow}>
                <h4>{r.label}</h4>
                {r.values.map((v, i) => <p key={i}><b>{cmpData.concepts[i].name}</b>：{v || "—"}</p>)}
              </div>))}
            {cmpData.between.length ? <div className={st.compareRow}><h4>この組の関係</h4>{cmpData.between.map((r) => <p key={r.id}>{sentence(net, r)}：{r.description}</p>)}</div> : null}
            {cmpData.common.length ? <div className={st.compareRow}><h4>共通の前提</h4><p>{cmpData.common.map((id) => name(net, id)).join("・")}</p></div> : null}
          </> : <Muted>比べる相手を選ぶ。</Muted>}
          <div className={st.cmpActs}>
            {cmp.length < 3 && <Button onClick={() => setModal("pick")}>＋ もう1つ足す</Button>}
            <Button variant="quiet" onClick={() => { setCmp([]); setModal(null); }}>比べるのをやめる</Button>
          </div>
        </Sheet>
      ) : null}
      {full && (
        <FullView label="ラボ" title={full.title ?? "ラボ"} onClose={() => setFull(null)}
          aside={<a href={full.url} target="_blank" rel="noreferrer">別の画面 ↗</a>}>
          <iframe src={full.url} title={full.title ?? "ラボ"} />
        </FullView>
      )}
      {edgeSel ? <Panel net={net} edgeId={edgeSel} onClose={() => setEdgeSel(null)} onSelect={(id) => setSel(id)} /> : null}
      <Muted as="div" className={st.footer}>データ：各教材の公開した JSON（型 kn-schema v1）。教材の原本は各教材のリポジトリ。</Muted>
    </main>
  );
}
