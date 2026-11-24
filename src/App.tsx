// 画面全体。状態は URL に持つ（?t=タブ&c=選んだ概念&view=path（前提をさかのぼる）&x=実験室&g=分類&lv=並べ方&embed=1&src=データ）。
// 画面は路線図（ホーム）と概念のページとひと目（stats2-course の issue 592。渡辺さん 2026-11-24「できる限りシンプルに」）。下のタブは置かない。
// 埋め込みではヘッダーを出さない。
// 概念を選ぶたびに履歴に積む（ブラウザの「戻る」で前の概念・表示に戻る）。
// 概念の地図は関係図の1つ（stats2-course #587・#588。渡辺さん 2026-11-23「こちらに一本化」）：どの入口（検索・ライブラリ・一覧・Notion の 🕸 リンク）から
// 概念を開いても、その概念の分類の関係図で開く。分類をまたぐ学ぶ順は「前提をさかのぼる」（全画面の一覧）で読む。
// Notion の埋め込み（高さ約320px）では embed=1：概念の名前と短い説明と「拡大表示 ↗」。
import { GlanceRoot, WithGlance } from "./Glance";
import Library from "./Library";
import Route, { rememberStation } from "./Route";
import UnitPage from "./UnitPage";
import CategoryList, { LayoutSwitch } from "./CategoryList";
import RelationMap from "./RelationMap";
import { useEffect, useMemo, useRef, useState } from "react";
import Detail, { name } from "./Detail";
import Panel from "./Panel";
import PathList from "./PathList";
import Search from "./Search";
import { Button, ErrorText, Experiment, FullView, Muted, Sheet, subText } from "@math-lab/ui";
import st from "./App.module.css";
import { experimentsFor, learnOrder, load, pairOpen, routeOf, trace, type Network } from "./data";
import { Crumbs, Header, Icon, LabPage, type Focus } from "./Shell";
import { fromUrl, toUrl, type Layout, type Tab, type View } from "./urlState";

const params = new URLSearchParams(location.search);
// ページの送り位置はアプリが決める（戻る・進むでブラウザが前の画面の送り位置を当てない。路線図で送った分が関係図に残った。
// stats2-course の issue 592 の段 3。2026-11-24）
if ("scrollRestoration" in history) history.scrollRestoration = "manual";
const EMBED = params.get("embed") === "1";
const SRC = params.get("src");

function useUrlState() {
  // 保存と復元は urlState.ts の1つの定義から（#142）
  const init = fromUrl(params);
  const [sel, setSelRaw] = useState<string | null>(init.sel);
  const [view, setView] = useState<View>(init.view);
  const [exp, setExpRaw] = useState<string | null>(init.exp);
  // 実験室の問い（?q=テーマ体系の問いの id）：実験室のタブの概念から、問いを直接開く（stats2-course #163）
  const [q, setQ] = useState<string | null>(init.q);
  // 実験室の「比べる」の記録カード（?cards=。条件と種だけなので、開けば同じ結果に戻る。stats2-course #122）
  const [cards, setCards] = useState<string | null>(init.cards);
  // 全体図を分類で絞る（?g=分類。#105 の骨格の分類）
  const [group, setGroupRaw] = useState<string | null>(init.group);
  // 分類のページの並べ方（?lv=。正方形・一覧・地図。stats2-course #228）
  const [layout, setLayoutRaw] = useState<Layout>(init.layout);
  /** 分類を変える。open＝ライブラリから分類のページを開く（「戻る」でライブラリへ戻れるよう履歴に積む）。
   *  地図の「分類で絞る」の選び直しは積まない（同じ履歴の中で書き換える） */
  const setGroup = (g: string | null, open = false) => {
    if (open) push.current = true;
    setGroupRaw(g);
  };
  const setLayout = (l: Layout) => {
    push.current = true;
    setLayoutRaw(l);
  };
  /** ライブラリから分類のページを開く（正方形から） */
  const openGroup = (g: string) => {
    setLayoutRaw("grid");
    setGroup(g, true);
  };
  // タブ（?t=。探索は付けない。実験室を開いているときは実験室）
  const [tab, setTabRaw] = useState<Tab>(init.tab);
  // 単元のページ（?u=。路線図の単元の見出しから。stats2-course の issue 596）
  const [unit, setUnitRaw] = useState<string | null>(init.unit);
  // 関係図のページで選んでいる語（?m=。issue 599）
  const [pick, setPickRaw] = useState<string | null>(init.pick);
  const push = useRef(false);
  const setSel = (id: string | null, replace = false) => {
    push.current = !replace;
    setSelRaw(id);
    setExpRaw(null);
    setQ(null);
    setCards(null);
    setTabRaw("explore");
  };
  const setExp = (id: string | null, question: string | null = null) => {
    push.current = true;
    setExpRaw(id);
    setQ(id ? question : null);
    setCards(null);
    if (id) setTabRaw("lab");
  };
  const setTab = (t: Tab) => {
    push.current = true;
    setTabRaw(t);
    setExpRaw(null);
    setQ(null);
    setCards(null);
    scrollTo(0, 0);
  };
  useEffect(() => {
    const p = toUrl({ sel, view, exp, q, cards, group, layout, tab, unit, pick }, new URLSearchParams(location.search));
    const url = `${location.pathname}?${p.toString()}`.replace(/\?$/, "");
    if (url === `${location.pathname}${location.search}`) return;
    // 概念のページとして開いた所は、履歴に印（page）を残す（戻る・進むで、また全画面のページで開く。issue 596）
    // アプリが積んだ履歴には印（app）を付ける。← は、印があれば履歴を1つ戻し、なければ（共有の URL で直接開いた）路線図へ（issue 599）
    if (push.current) history.pushState({ app: true }, "", url);
    else history.replaceState(history.state, "", url);
    push.current = false;
  }, [sel, view, exp, q, cards, group, layout, tab, unit, pick]);
  useEffect(() => {
    // 「戻る」：URL から全部の項目を、書き込みと同じ定義で戻す
    const back = () => {
      const s = fromUrl(new URLSearchParams(location.search));
      setSelRaw(s.sel);
      setView(s.view);
      setExpRaw(s.exp);
      setQ(s.q);
      setCards(s.cards);
      setGroupRaw(s.group);
      setLayoutRaw(s.layout);
      setTabRaw(s.tab);
      setUnitRaw(s.unit);
      setPickRaw(s.pick);
    };
    addEventListener("popstate", back);
    return () => removeEventListener("popstate", back);
  }, []);
  const setUnit = (u: string | null, replace = false) => {
    push.current = !replace;
    setUnitRaw(u);
  };
  const setViewPush = (v: View) => {
    push.current = true;
    setView(v);
  };
  /** 関係図で語を選ぶ（それだけでは履歴に積まない。選びなおすたびに戻るが増えない） */
  const setPick = (id: string | null) => setPickRaw(id);
  return {
    pick,
    setPick,
    sel,
    setSel,
    view,
    setView: setViewPush,
    /** 履歴に積まずに表示を替える（直接開いた一覧を閉じるとき。閉じた一覧が「戻る」で開き直さない） */
    replaceView: setView,
    unit,
    setUnit,
    exp,
    setExp,
    q,
    cards,
    setCards,
    group,
    setGroup,
    layout,
    setLayout,
    openGroup,
    tab,
    setTab,
  };
}

export default function App() {
  // 詳しくの段（少し・半分・全部）。別の概念を選ぶと「少し」から
  const [searchOpen, setSearchOpen] = useState(false);
  const [net, setNet] = useState<Network | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const {
    pick,
    setPick,
    sel,
    setSel,
    view,
    setView,
    replaceView,
    unit,
    setUnit,
    exp,
    setExp,
    q,
    cards,
    setCards,
    group,
    setGroup,
    layout,
    setLayout,
    openGroup,
    tab: tabRaw,
    setTab,
  } = useUrlState();
  // 学習・問題集のタブはなくした（路線図の単元の見出しに入れた。issue 592 の段 3）。前の URL（?t=learn・problems）は路線図で開く
  const tab = tabRaw === "lab" ? "lab" : "explore";
  // スマホで概念を選んでいる間は、ページを縦に送らない（地図は面の上いっぱいに合わせてある）。送れると下のタブと面が画面の途中に浮く（渡辺さん 2026-11-01）
  // 概念を選んでいる間は、どの幅でも関係図が画面いっぱいになり、詳しくは下からの面で出す（関係図に一本化。stats2-course #588。
  // 広い画面で面にしないと、詳しくが画面いっぱいの関係図の後ろに隠れた）
  const locked = !!sel && tab === "explore" && !exp;
  useEffect(() => {
    if (!locked) return;
    scrollTo(0, 0);
    const r = document.documentElement,
      b = document.body;
    r.style.overflow = "hidden";
    b.style.overflow = "hidden";
    r.style.overscrollBehavior = "none";
    return () => {
      r.style.overflow = "";
      b.style.overflow = "";
      r.style.overscrollBehavior = "";
    };
  }, [locked]);
  // 下から開く面は1つだけ：2つの概念のページ（edge。関係と比べる）か、比べる相手を選ぶ（pick）
  const [edgeSel, setEdgeRaw] = useState<string | null>(null);
  const [modal, setModalRaw] = useState<"pick" | null>(null);
  const setEdgeSel = (id: string | null) => {
    setEdgeRaw(id);
    if (id) setModalRaw(null);
  };
  const setModal = (m: typeof modal) => {
    setModalRaw(m);
    if (m) setEdgeRaw(null);
  };
  // 前提をさかのぼる一覧を、このページの中から開いたか（閉じ方を分ける）
  const pathHere = useRef(false);
  // 単元のページを、路線図から開いたか（閉じ方を分ける。前提の一覧と同じ）
  const unitHere = useRef(false);
  // 概念はいつも全画面のページで開く（関係図の上の面はやめた。issue 599）
  const openPage = (id: string) => {
    if (id !== sel) setSel(id);
  };
  // ← はどのページでも1つ：アプリが積んだ履歴なら1つ戻る。共有の URL で直接開いたページなら、置き換えて路線図へ（サイトの外へ出ない）
  const back = () => {
    if ((history.state as { app?: boolean } | null)?.app) history.back();
    else {
      setSel(null, true);
      setGroup(null);
    }
  };
  // 現在地：最後に開いた概念（その端末にだけ。路線図の「前に開いた駅」）
  useEffect(() => {
    if (sel) rememberStation(sel);
  }, [sel]);
  useEffect(() => {
    setEdgeRaw(null);
  }, [sel]); // 別の概念へ進んだら、線の説明は閉じる
  // ラボを全面で開く：一覧の「大きく開く」と、ラボの中の「大きく開く ↗」（host=kn のときは親に知らせてくる）
  const [full, setFull] = useState<{ url: string; title?: string } | null>(null);
  useEffect(() => {
    const own = (e: Event) => setFull((e as CustomEvent<{ url: string; title?: string }>).detail);
    const msg = (e: MessageEvent) => {
      const d = e.data as { type?: string; url?: string } | null;
      if (d?.type !== "lab:open" || typeof d.url !== "string") return;
      try {
        if (new URL(d.url).origin !== e.origin) return;
      } catch {
        return;
      } // ラボ自身の場所のページだけ開く
      setFull({ url: d.url });
    };
    addEventListener("kn:open-lab", own);
    addEventListener("message", msg);
    return () => {
      removeEventListener("kn:open-lab", own);
      removeEventListener("message", msg);
    };
  }, []);

  useEffect(() => {
    load(SRC).then((r) => {
      setNet(r.net);
      setErrors(r.errors);
      // 前の「比較」の URL（?cmp=A,B）は、2つの概念のページで開く
      const old = (params.get("cmp") ?? "").split(",").filter((x) => r.net.concepts.has(x));
      if (old.length >= 2) setEdgeSel(pairOpen(r.net, old[0]!, old[1]!));
    });
  }, []);

  // 前提をさかのぼる（view=path）：選んだ概念の前提を学ぶ順（遠い前提から）に並べた全画面の一覧（stats2-course #588 B2）
  // 路線図の駅の並び（概念のページの「次の駅」）
  const route = useMemo(() => (net ? routeOf(net) : null), [net]);
  const tr = useMemo(() => (net && sel && net.concepts.has(sel) ? trace(net, sel) : null), [net, sel]);
  const seq = useMemo(
    () => (tr ? learnOrder(tr).filter((id) => id !== sel && net?.concepts.has(id)) : []),
    [tr, sel, net],
  );
  if (!net)
    return (
      <main className={st.app}>
        <Muted>読み込み中…</Muted>
        {errors.map((e) => (
          <ErrorText key={e}>{e}</ErrorText>
        ))}
      </main>
    );
  const concept = sel ? net.concepts.get(sel) : undefined;
  const tracing = view === "path" && !!concept;
  const nextId = concept && route ? route.order[route.order.indexOf(concept.id) + 1] : undefined;
  // 地図は関係図（stats2-course #588）：概念を選んでいればその概念の分類、選んでいなければ分類のページの「地図」で開いた分類
  // 関係図はページ（分類の「地図」）。概念のページの「関係図で見る」からも開く（issue 599）
  const mapCat = !concept && group && group !== "*" && layout === "map" ? group : undefined;

  if (EMBED) {
    // 埋め込み（Notion の 360×320）は入口：名前・短い説明・拡大表示（地図は大きく開いた先の関係図で見る。stats2-course #588）
    const full = `${location.pathname}?${new URLSearchParams({ ...(sel ? { c: sel } : {}), ...(SRC ? { src: SRC } : {}) }).toString()}`;
    return (
      <main className={st.embed}>
        <div className={st.embedCard} data-testid="embed-card">
          <b>{concept ? concept.name : "知識ネットワーク"}</b>
          <Muted className={st.clamp}>
            {subText(concept?.gist ?? concept?.definition ?? "概念を開くと、関係図と説明が出る")}
          </Muted>
          <a href={full} target="_blank" rel="noreferrer">
            拡大表示 ↗
          </a>
        </div>
      </main>
    );
  }

  // 実験室（?x=）：同じサイトの1ページ。戻ると概念のページへ
  const xdef = exp ? net.experiments.get(exp) : undefined;
  if (xdef) {
    const formulaOf = (id?: string, i = 0) => {
      const f = id ? net.concepts.get(id)?.formulas?.[i] : undefined;
      return f ? { ...f, symbols: f.symbols?.flatMap((x) => (x.key ? [{ ...x, key: x.key }] : [])) } : undefined;
    };
    // 概念の作業台（式で決まる分布の workspace）。理由の段は問いの主概念 → 関連概念の順でこれを引く（stats2-course #171）
    const wsOf = (cid?: string) => {
      const w = cid ? net.concepts.get(cid)?.workspace : undefined,
        f = w ? formulaOf(cid, w.formula) : undefined;
      return w && f?.tree
        ? { formula: f, mean: w.mean !== undefined ? formulaOf(cid, w.mean) : undefined, vary: w.vary, over: w.over }
        : undefined;
    };
    // 実験の中の用語はひと目で開く（実験を閉じない。段・予測・条件・結果が残る。stats2-course の issue 595）。
    // ひと目の「ページを開く」で、初めて概念のページへ移る
    return (
      <GlanceRoot net={net} onOpen={(id) => setSel(id)}>
        <main className={st.app}>
          <WithGlance>
            {(glance) => (
              <Experiment
                key={`${xdef.id}-${q ?? ""}`}
                def={xdef}
                walkTexts={net.walkTexts.get(xdef.id.split(":")[0]!)}
                applyTexts={net.applyTexts.get(xdef.id.split(":")[0]!)}
                open={q ? xdef.catalog?.flatMap((g) => g.items).find((it) => it.id === q)?.open : undefined}
                cards={cards ?? undefined}
                onCards={(e) => setCards(e || null)}
                reasonFormula={formulaOf(xdef.reason?.concept, xdef.reason?.formula)}
                spreadFormula={
                  "spread_reason" in xdef && xdef.spread_reason
                    ? formulaOf(xdef.spread_reason.concept, xdef.spread_reason.formula)
                    : undefined
                }
                mainFormula={formulaOf(xdef.links.concepts?.[0])}
                onConcept={(id) => net.concepts.has(id) && glance(id)}
                conceptName={(id) => name(net, id)}
                onBack={() => (history.length > 1 ? history.back() : setExp(null))}
                definitions={(id) =>
                  (net.concepts.get(id)?.formulas ?? []).map(
                    (f) => formulaOf(id, (net.concepts.get(id)?.formulas ?? []).indexOf(f))!,
                  )
                }
                workspace={wsOf(xdef.reason?.concept ?? xdef.links.concepts?.[0])}
                workspaceOf={wsOf}
              />
            )}
          </WithGlance>
        </main>
      </GlanceRoot>
    );
  }
  const sub = net.courses.map((c) => c.title).join("・");
  // 選んだ概念の分：実験室の一覧をその分に絞る（概念のページの「実験室で検証」から開く）
  const fc = sel ? net.concepts.get(sel) : undefined;
  const focus: Focus | null = fc
    ? {
        id: fc.id,
        name: fc.name,
        units: fc.units,
        problems: fc.problems,
        exps: experimentsFor(net, fc.id).map((x) => x.id),
      }
    : null;
  // 実験室の一覧（概念のページの「実験室で検証」から）。学習・問題集は路線図の単元の見出しに入れた（下のタブは置かない。issue 592 の段 3）
  if (tab === "lab")
    return (
      <main className={st.app}>
        <Header title="知識ネットワーク" sub={sub} />
        {/* 来た所へ戻る ← を上に。履歴を戻すのでなく、概念のページか路線図へ（URL で直接開いたときにサイトの外へ戻らない） */}
        <button type="button" className={st.backTo} onClick={() => setTab("explore")} data-testid="tab-back">
          <span aria-hidden="true">←</span> {focus ? focus.name : "路線図"}
        </button>
        <LabPage net={net} onOpen={setExp} focus={focus} />
      </main>
    );
  const compact = !!concept;
  return (
    <GlanceRoot
      net={net}
      current={concept?.id}
      onOpen={(id) => {
        setView("around");
        setSel(id);
      }}
    >
      <main className={`${st.app}${edgeSel || modal ? ` ${st.withSheet} has-panel` : ""}`}>
        <div className={st.top} data-edge="top">
          <Header
            title="知識ネットワーク"
            sub={
              <>
                {sub}
                {compact ? null : (
                  <>
                    　概念 {[...net.concepts.values()].filter((c) => c.status === "filled").length}
                    {(() => {
                      const k = [...net.concepts.values()].filter((c) => c.status === "skeleton").length;
                      return k ? `（定義だけ ${k}）` : "";
                    })()}
                    ・関係 {net.relations.length}・導出 {net.derivations.length}
                  </>
                )}
              </>
            }
          >
            {compact ? (
              <Button
                variant="quiet"
                icon
                aria-label="概念を検索"
                aria-expanded={searchOpen}
                onClick={() => setSearchOpen(!searchOpen)}
              >
                <Icon name="search" size={20} />
              </Button>
            ) : null}
          </Header>
          {!compact || searchOpen ? (
            <Search
              concepts={[...net.concepts.values()]}
              onPick={(id) => {
                setSearchOpen(false);
                openPage(id);
              }}
            />
          ) : null}
          <Crumbs
            items={[
              // いちばん上はライブラリ（入口）。ライブラリ → 分類 → 語 の3段をパンくずで示す（UI レビュー「地図の変更で見直した点」1）
              ...(concept || group
                ? [
                    {
                      label: "路線図",
                      onClick: () => {
                        setSel(null);
                        setGroup(null);
                      },
                    },
                  ]
                : []),
              ...(concept
                ? [
                    ...(concept.category
                      ? [
                          {
                            label: concept.category,
                            onClick: () => {
                              setSel(null);
                              setGroup(concept.category!);
                            },
                          },
                        ]
                      : []),
                    { label: concept.name },
                  ]
                : group
                  ? [{ label: group === "*" ? "分類" : group }]
                  : []),
            ]}
          />
        </div>
        {errors.map((e) => (
          <ErrorText key={e}>{e}</ErrorText>
        ))}
        {/* 分類のページ（ライブラリでタイルを押したあと）：並べ方の切り替え。正方形・一覧はリストビュー、地図は関係図（stats2-course #228） */}
        {!sel && group && group !== "*" ? (
          <div className={st.catBar} data-edge="top">
            <LayoutSwitch value={layout} onChange={setLayout} />
          </div>
        ) : null}
        {/* 何も選ばず分類も決めていないときの入口：分類のライブラリ。分類を押すとその分類のページ、語を押すと概念 */}
        {!sel && !group ? (
          <Route
            net={net}
            onOpen={openPage}
            onGroups={() => setGroup("*")}
            onUnit={(u) => {
              unitHere.current = true;
              setUnit(u);
            }}
          />
        ) : !sel && group === "*" ? (
          <Library net={net} onConcept={setSel} onGroup={openGroup} />
        ) : !sel && layout !== "map" ? (
          <CategoryList net={net} category={group!} layout={layout} onConcept={setSel} />
        ) : mapCat ? (
          // 関係図のページ（issue 599）：語を押すと選んで（?m=）ひと目。ダブルタップ・ひと目の「ページを開く」で概念のページ
          <WithGlance>
            {(_glance, show) => (
              <RelationMap
                key={mapCat}
                net={net}
                category={mapCat}
                selected={pick}
                onSelect={(id) => {
                  setPick(id);
                  show(id);
                }}
                onOpen={openPage}
                onRelation={setEdgeSel}
                onOut={() => {
                  setSel(null);
                  setGroup(null, true);
                }}
                trail={false}
                onCategory={back}
              />
            )}
          </WithGlance>
        ) : null}
        {concept ? (
          <Detail
            net={net}
            concept={concept}
            sheet={{ detent: "full", onDetent: back, bottom: 0 }}
            next={nextId ? { id: nextId, name: net.concepts.get(nextId)!.name } : undefined}
            onNext={(id) => openPage(id)}
            onMap={() => {
              // 関係図で見る：この概念の分類の関係図のページで、この概念を選んだ所から（← で概念のページへ戻る）
              const c = concept;
              setSel(null);
              setGroup(c.category ?? null);
              setLayout("map");
              setPick(c.id);
            }}
            onCompare={() => setModal("pick")}
            onSelect={setSel}
            onEdge={setEdgeSel}
            edgeSel={edgeSel}
            onQuestion={(x, q) => setExp(x, q)}
            onLab={() => setTab("lab")}
            onTrace={() => {
              pathHere.current = true;
              setView("path");
            }}
            traceCount={seq.length}
          />
        ) : null}
        {unit && !sel && net.units.has(unit) ? (
          <UnitPage
            net={net}
            id={unit}
            onConcept={openPage}
            onExperiment={(x) => setExp(x)}
            onClose={() => {
              // 路線図から開いたものは履歴を1つ戻して閉じる。共有の URL で直接開いたものは置き換えて路線図に
              if (unitHere.current) {
                unitHere.current = false;
                history.back();
              } else setUnit(null, true);
            }}
          />
        ) : null}
        {tracing ? (
          <PathList
            net={net}
            target={concept!.id}
            seq={seq}
            onOpen={(id) => {
              setView("around");
              setSel(id);
            }}
            onClose={() => {
              // アプリの中で開いた一覧は、履歴を1つ戻して閉じる（そのあと「戻る」で一覧が開き直さない）。
              // 共有・旧 URL で直接開いた一覧は、履歴を置き換えて同じ概念に留まる（stats2-course の issue 595）
              if (pathHere.current) history.back();
              else replaceView("around");
            }}
          />
        ) : null}
        {modal === "pick" && concept ? (
          // 比べる相手を選ぶ（2つの概念のページへ）。関係のある相手は関係のタブ・地図の線から開くので、ここは探すだけ
          <Sheet
            label="比べる概念を選ぶ"
            title={`${concept.name} と比べる`}
            onClose={() => setModal(null)}
            data-testid="pick"
          >
            <Muted>選ぶと、2つの概念のページで関係と、定義・条件・反例を並べて見られる。</Muted>
            <Search
              concepts={[...net.concepts.values()].filter((c) => c.id !== concept.id)}
              onPick={(id) => {
                setModal(null);
                setEdgeSel(pairOpen(net, concept.id, id));
              }}
            />
          </Sheet>
        ) : null}
        {full && (
          <FullView
            label="実験室"
            title={full.title ?? "実験室"}
            onClose={() => setFull(null)}
            aside={
              <a href={full.url} target="_blank" rel="noreferrer">
                別画面で開く ↗
              </a>
            }
          >
            <iframe src={full.url} title={full.title ?? "実験室"} />
          </FullView>
        )}
        {edgeSel ? (
          <Panel
            net={net}
            edgeId={edgeSel}
            onClose={() => setEdgeSel(null)}
            onSelect={(id) => setSel(id)}
            page={!!concept && !tracing}
            onQuestion={(x, q) => setExp(x, q)}
          />
        ) : null}
        {concept || group ? null : (
          <Muted as="div" className={st.footer}>
            データ：各教材の公開した JSON（型 kn-schema v2）。教材の原本は各教材のリポジトリ。
          </Muted>
        )}
      </main>
    </GlanceRoot>
  );
}
