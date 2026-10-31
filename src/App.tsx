// 画面全体。状態は URL に持つ（?t=タブ&c=選んだ概念&view=around|all&cmp=比べる概念&trace=1&x=実験室&embed=1&src=データ）。
// 下のタブは4つ（探索・学習・実験室・問題集。stats2-course #130）。埋め込みではタブとヘッダーを出さない。
// 概念を選ぶたびに履歴に積む（ブラウザの「戻る」で前の概念・表示に戻る）。
// c を付けて開いたとき（Notion の 🕸 リンク）は、その概念の周辺図から始める。
// Notion の埋め込み（高さ約320px）では embed=1：選んだ概念の周辺図と、短い説明と「大きく開く ↗」。
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Detail, { name, sentence } from "./Detail";
import Graph, { TYPE_COLOR } from "./Graph";
import Panel from "./Panel";
import PathList from "./PathList";
import Search from "./Search";
import { Button, ErrorText, Experiment, FullView, Muted, Segmented, Sheet, type Detent } from "@math-lab/ui";
import st from "./App.module.css";
import { KINDS, MODES, around, compare, learnOrder, load, neighborhood, trace, type Network } from "./data";
import { relationParts } from "./Relation";
import { Crumbs, Header, Icon, LabPage, LearnPage, ProblemsPage, TabBar, readTab, type Tab } from "./Shell";

const params = new URLSearchParams(location.search);
const EMBED = params.get("embed") === "1";
const SRC = params.get("src");

type View = "around" | "path" | "all";   // フォーカス（まわり）・経路（前提をさかのぼる）・俯瞰（全体）
const readView = (p: URLSearchParams): View => (p.get("view") === "all" ? "all" : p.get("view") === "path" || (p.get("trace") === "1" && p.get("c")) ? "path" : p.get("view") === "around" || p.get("c") ? "around" : "all");

function useUrlState() {
  const [sel, setSelRaw] = useState<string | null>(params.get("c"));
  const [view, setView] = useState<View>(readView(params));
  const [cmp, setCmp] = useState<string[]>((params.get("cmp") ?? "").split(",").filter(Boolean));
  const [exp, setExpRaw] = useState<string | null>(params.get("x"));
  // 実験室の「比べる」の記録カード（?cards=。条件と種だけなので、開けば同じ結果に戻る。stats2-course #122）
  const [cards, setCards] = useState<string | null>(params.get("cards"));
  // 全体図を分類で絞る（?g=分類。#105 の骨格の分類）
  const [group, setGroup] = useState<string | null>(params.get("g"));
  // タブ（?t=。探索は付けない。実験室を開いているときは実験室）
  const [tab, setTabRaw] = useState<Tab>(readTab(params));
  const push = useRef(false);
  const setSel = (id: string | null) => { push.current = true; setSelRaw(id); setExpRaw(null); setCards(null); setTabRaw("explore"); };
  const setExp = (id: string | null) => { push.current = true; setExpRaw(id); setCards(null); if (id) setTabRaw("lab"); };
  const setTab = (t: Tab) => { push.current = true; setTabRaw(t); setExpRaw(null); setCards(null); scrollTo(0, 0); };
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    const set = (k: string, v: string | null) => (v ? p.set(k, v) : p.delete(k));
    set("c", sel); set("view", sel ? view : null); set("cmp", cmp.join(",") || null); set("trace", null); set("x", exp); set("cards", exp ? cards : null); set("g", group); set("t", tab === "explore" || exp ? null : tab);
    const url = `${location.pathname}?${p.toString()}`.replace(/\?$/, "");
    if (url === `${location.pathname}${location.search}`) return;
    if (push.current) history.pushState(null, "", url); else history.replaceState(null, "", url);
    push.current = false;
  }, [sel, view, cmp, exp, cards, group, tab]);
  useEffect(() => {   // 「戻る」：URL から選んだ概念と表示を戻す
    const back = () => { const p = new URLSearchParams(location.search); setSelRaw(p.get("c")); setView(readView(p)); setExpRaw(p.get("x")); setCards(p.get("cards")); setTabRaw(readTab(p)); };
    addEventListener("popstate", back);
    return () => removeEventListener("popstate", back);
  }, []);
  const setViewPush = (v: View) => { push.current = true; setView(v); };
  return { sel, setSel, view, setView: setViewPush, cmp, setCmp, exp, setExp, cards, setCards, group, setGroup, tab, setTab };
}

/** スマホの幅か（詳しくを下からの面にする） */
function useNarrow() {
  const q = "(max-width: 759px)";
  const [n, setN] = useState(() => typeof matchMedia === "function" && matchMedia(q).matches);
  useEffect(() => { const m = matchMedia(q); const f = () => setN(m.matches); m.addEventListener("change", f); return () => m.removeEventListener("change", f); }, []);
  return n;
}

/** 詳しくの面をしまったときの高さ（つまみと名前の1行） */
const SHEET_MIN = 84;

export default function App() {
  const narrow = useNarrow();
  // 詳しくの段（少し・半分・全部）。別の概念を選ぶと「少し」から
  const [detent, setDetent] = useState<Detent>("peek");
  const [tabH, setTabH] = useState(58);
  // スマホで概念を選んでいるとき：上を詰め（探すは印に）、地図の高さを上の欄と詳しくの面（少し）の間の空きに合わせる（#42）
  const [peek, setPeek] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const aboveMap = useRef<HTMLDivElement>(null);
  const [mapH, setMapH] = useState<number | undefined>(undefined);
  const [net, setNet] = useState<Network | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const { sel, setSel, view, setView, cmp, setCmp, exp, setExp, cards, setCards, group, setGroup, tab, setTab } = useUrlState();
  useLayoutEffect(() => {
    if (!narrow || !sel || tab !== "explore" || exp) { setMapH(undefined); return; }
    const fit = () => {
      const top = aboveMap.current?.getBoundingClientRect().bottom;
      if (top === undefined || !peek) return;
      const sheet = detent === "min" ? SHEET_MIN : peek;   // 半分・全部のときは面が地図に重なるので、少しの高さで決めたままにする
      setMapH(Math.max(200, Math.round(innerHeight - (top + scrollY) - 24 - sheet - tabH)));
    };
    fit();
    addEventListener("resize", fit);
    return () => removeEventListener("resize", fit);
  }, [narrow, sel, tab, exp, peek, tabH, detent, view, searchOpen]);
  // 下から開く面は1つだけ：線の説明（edge）か、線の見方（kinds）・前提（trace）・比べる（compare）
  const [edgeSel, setEdgeRaw] = useState<string | null>(null);
  const [modal, setModalRaw] = useState<"kinds" | "compare" | "pick" | null>(null);
  const setEdgeSel = (id: string | null) => { setEdgeRaw(id); if (id) setModalRaw(null); };
  const setModal = (m: typeof modal) => { setModalRaw(m); if (m) setEdgeRaw(null); };
  useEffect(() => { setEdgeRaw(null); setDetent("peek"); }, [sel]);   // 別の概念へ進んだら、線の説明は閉じ、詳しくは「少し」に
  useEffect(() => {   // 下のタブの高さ（詳しくの面はその上に乗る）
    const el = document.querySelector<HTMLElement>('[data-testid="tabbar"]');
    if (!el || typeof ResizeObserver !== "function") return;
    const ro = new ResizeObserver(() => setTabH(el.offsetHeight)); ro.observe(el); return () => ro.disconnect();
  });
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

  // 経路：選んだ概念の前提をさかのぼった点だけを、学ぶ順（遠い前提から）に番号を付けて上から並べる
  const tracing = view === "path" && !!sel;
  const tr = useMemo(() => (net && sel && tracing ? trace(net, sel) : null), [net, sel, tracing]);
  const path = useMemo(() => {
    if (!tr || !sel || !net) return undefined;
    const only = new Set<string>([sel, ...tr.order]);
    for (const st of tr.steps) if (!net.relations.some((x) => x.from === st.from && x.to === st.to && x.type === st.via)) only.add(st.via);   // 導出の点
    const seq = learnOrder(tr);
    const numbers = new Map(seq.map((id, i) => [id, i + 1] as const));
    return { only, numbers, seq };
  }, [tr, sel, net]);
  const highlight = useMemo(() => new Set<string>(), []);
  // 分類（データに出てくる順）と、絞ったときに出す点：分類の概念 ＋ 1本の線でつながる点（薄く）＋ その間の導出
  const groups = useMemo(() => (net ? [...new Set([...net.concepts.values()].map((c) => c.category).filter((x): x is string => !!x))] : []), [net]);
  // 選んだ概念があって分類を決めていないときは、その概念の分類で絞る（全体図でも迷わないように）
  const eff = group ?? (sel ? net?.concepts.get(sel)?.category ?? null : null);
  const grouped = useMemo(() => {
    if (!net || !eff) return { only: undefined, outer: undefined };
    const core = new Set([...net.concepts.values()].filter((c) => c.category === eff).map((c) => c.id));
    if (!core.size) return { only: undefined, outer: undefined };
    const only = new Set(core), outer = new Set<string>();
    for (const r of net.relations) {
      if (core.has(r.from) && !core.has(r.to)) { only.add(r.to); outer.add(r.to); }
      if (core.has(r.to) && !core.has(r.from)) { only.add(r.from); outer.add(r.from); }
    }
    for (const d of net.derivations) if ([d.conclusion, ...d.premises].some((p) => core.has(p))) { only.add(d.id); for (const p of [d.conclusion, ...d.premises]) if (!core.has(p)) { only.add(p); outer.add(p); } }
    return { only, outer };
  }, [net, eff]);
  // 分類の地図（#105）：分類ごとの語の数と、分類の間の関係の本数（学ぶ順の向き）。全体図の入口
  const overview = useMemo(() => {
    if (!net || eff !== null || groups.length < 2) return undefined;
    const cat = (id: string) => net.concepts.get(id)?.category;
    const nodes = groups.map((g) => ({ id: g, label: `${g}\n${[...net.concepts.values()].filter((c) => c.category === g).length}語` }));
    const w = new Map<string, number>();
    for (const r of net.relations) { const a = cat(r.from), b = cat(r.to); if (a && b && a !== b) w.set(`${a}>${b}`, (w.get(`${a}>${b}`) ?? 0) + 1); }
    // 行き来のある2つの分類は、本数の多い向きの1本にまとめる（線が絡まないように）
    const edges: { id: string; source: string; target: string; w: number }[] = [];
    for (const [k, n] of w) {
      const [a, b] = k.split(">") as [string, string], back = w.get(`${b}>${a}`) ?? 0;
      if (n > back || (n === back && a < b)) edges.push({ id: `ge:${k}`, source: a, target: b, w: n + back });
    }
    return { nodes, edges };
  }, [net, eff, groups]);
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
        <Experiment key={xdef.id} def={xdef} cards={cards ?? undefined} onCards={(e) => setCards(e || null)} reasonFormula={formulaOf(xdef.reason?.concept, xdef.reason?.formula)} mainFormula={formulaOf(xdef.links.concepts?.[0])}
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
  const sub = net.courses.map((c) => c.title).join("・");
  if (tab !== "explore") return (
    <main className={`${st.app} ${st.withTabs}`}>
      <Header title="知識ネットワーク" sub={sub} />
      {tab === "learn" ? <LearnPage net={net} /> : tab === "lab" ? <LabPage net={net} onOpen={setExp} /> : <ProblemsPage net={net} />}
      <TabBar tab={tab} onTab={setTab} />
    </main>
  );
  const cmpData = cmp.length >= 2 ? compare(net, cmp) : null;
  const compact = narrow && !!concept;
  return (
    <main className={`${st.app} ${st.withTabs}${narrow && concept ? ` ${st.withDetailSheet}` : ""}${edgeSel || modal ? ` ${st.withSheet} has-panel` : ""}`}>
      <div className={st.top}>
        <Header title="知識ネットワーク" sub={<>{sub}{compact ? null : <>　概念 {[...net.concepts.values()].filter((c) => c.status === "filled").length}{(() => { const k = [...net.concepts.values()].filter((c) => c.status === "skeleton").length; return k ? `（骨格 ${k}）` : ""; })()}・関係 {net.relations.length}・導出 {net.derivations.length}</>}</>}>
          {compact ? <Button variant="quiet" icon aria-label="探す" aria-expanded={searchOpen} onClick={() => setSearchOpen(!searchOpen)}><Icon name="search" size={20} /></Button> : null}
        </Header>
        {!compact || searchOpen ? <Search concepts={[...net.concepts.values()]} onPick={(id) => { setSearchOpen(false); setSel(id); }} /> : null}
        <Crumbs items={concept ? [
          ...(concept.category ? [{ label: concept.category, onClick: () => { setSel(null); setGroup(concept.category!); } }] : []),
          { label: concept.name, ...(path ? { onClick: () => setView("around") } : {}) },
          ...(path ? [{ label: "前提をさかのぼる" }] : []),
        ] : eff ? [{ label: eff === "*" ? "全部の語" : eff }] : []} />
      </div>
      {errors.map((e) => <ErrorText key={e}>{e}</ErrorText>)}
      {concept ? (
        <div className={st.views} ref={aboveMap}>
          <Segmented label="見方" value={view} onChange={(v) => { if (v) setView(v as View); }} items={[
            { value: "around", label: "フォーカス" }, { value: "path", label: "経路" }, { value: "all", label: "俯瞰" },
          ]} />
        </div>
      ) : null}
      <Graph net={net} selected={sel} highlight={highlight} hidden={hidden} positions={positions} numbers={path?.numbers} height={mapH}
        onSelect={(id) => (id?.startsWith("group:") ? setGroup(id.slice(6)) : setSel(id))} onEdge={(id) => { if (!id.startsWith("ge:")) setEdgeSel(id); }} edgeSel={edgeSel}
        only={positions ? undefined : path ? path.only : grouped.only} outer={positions || path ? undefined : grouped.outer}
        overview={positions || path ? undefined : overview}
        topLeft={<>
          {!positions && !path && groups.length > 1 ? (
            <select className={st.groupSel} value={eff ?? ""} onChange={(e) => setGroup(e.target.value || null)} aria-label="分類で絞る" data-testid="group-select">
              <option value="">分類の地図</option>
              <option value="*">全部の語（{[...net.concepts.values()].length}）</option>
              {groups.map((g) => <option key={g} value={g}>{g}（{[...net.concepts.values()].filter((c) => c.category === g).length}）</option>)}
            </select>
          ) : null}
        </>}
        bottomLeft={<>
          <button type="button" className={st.chipBtn} onClick={() => setModal("kinds")}>線の見方{hidden.size ? `・${hidden.size} 種類を隠す` : ""}</button>
          {cmp.length ? <button type="button" className={st.chipBtn} onClick={() => setModal("compare")}>比べる {cmp.length}</button> : null}
        </>} />
      {concept && path ? <PathList net={net} target={concept.id} seq={path.seq} onOpen={(id) => { setView("around"); setSel(id); }}
        sheet={narrow ? { detent, onDetent: setDetent, bottom: tabH, onPeek: setPeek } : undefined} /> :
        concept ? <Detail net={net} concept={concept} inCompare={cmp.includes(concept.id)}
        sheet={narrow ? { detent, onDetent: setDetent, bottom: tabH, onPeek: setPeek } : undefined} onExperiment={setExp} onCompare={() => { if (!cmp.includes(concept.id)) setCmp([concept.id]); setModal("pick"); }} onSelect={setSel} onEdge={setEdgeSel} edgeSel={edgeSel} /> :
        null}
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
      <TabBar tab="explore" onTab={setTab} />
    </main>
  );
}
