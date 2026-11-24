// 画面全体。状態は URL に持つ（?t=タブ&c=選んだ概念&view=path（前提をさかのぼる）&x=実験室&g=分類&lv=並べ方&embed=1&src=データ）。
// 下のタブは4つ（探索・学習・実験室・問題集。stats2-course #130）。埋め込みではタブとヘッダーを出さない。
// 概念を選ぶたびに履歴に積む（ブラウザの「戻る」で前の概念・表示に戻る）。
// 概念の地図は関係図の1つ（stats2-course #587・#588。渡辺さん 2026-11-23「こちらに一本化」）：どの入口（検索・ライブラリ・一覧・Notion の 🕸 リンク）から
// 概念を開いても、その概念の分類の関係図で開く。分類をまたぐ学ぶ順は「前提をさかのぼる」（全画面の一覧）で読む。
// Notion の埋め込み（高さ約320px）では embed=1：概念の名前と短い説明と「拡大表示 ↗」。
import { GlanceRoot } from "./Glance";
import { STEPS, stepDown } from "./steps";
import Library from "./Library";
import CategoryList, { LayoutSwitch } from "./CategoryList";
import RelationMap from "./RelationMap";
import { useEffect, useMemo, useRef, useState } from "react";
import Detail, { name } from "./Detail";
import Panel from "./Panel";
import PathList from "./PathList";
import Search from "./Search";
import { Button, ErrorText, Experiment, FullView, Muted, Sheet, type Detent, subText } from "@math-lab/ui";
import st from "./App.module.css";
import { experimentsFor, learnOrder, load, pairOpen, trace, type Network } from "./data";
import { Crumbs, Header, Icon, LabPage, LearnPage, ProblemsPage, TabBar, focusBadges, type Focus } from "./Shell";
import { fromUrl, toUrl, type Layout, type Tab, type View } from "./urlState";

const params = new URLSearchParams(location.search);
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
  const push = useRef(false);
  const setSel = (id: string | null) => {
    push.current = true;
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
    const p = toUrl({ sel, view, exp, q, cards, group, layout, tab }, new URLSearchParams(location.search));
    const url = `${location.pathname}?${p.toString()}`.replace(/\?$/, "");
    if (url === `${location.pathname}${location.search}`) return;
    if (push.current) history.pushState(null, "", url);
    else history.replaceState(null, "", url);
    push.current = false;
  }, [sel, view, exp, q, cards, group, layout, tab]);
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
    };
    addEventListener("popstate", back);
    return () => removeEventListener("popstate", back);
  }, []);
  const setViewPush = (v: View) => {
    push.current = true;
    setView(v);
  };
  return {
    sel,
    setSel,
    view,
    setView: setViewPush,
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

/** スマホの幅か（詳しくを下からの面にする） */
function useNarrow() {
  const q = "(max-width: 759px)";
  const [n, setN] = useState(() => typeof matchMedia === "function" && matchMedia(q).matches);
  useEffect(() => {
    const m = matchMedia(q);
    const f = () => setN(m.matches);
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);
  return n;
}

export default function App() {
  const narrow = useNarrow();
  // 詳しくの段（少し・半分・全部）。別の概念を選ぶと「少し」から
  const [detent, setDetent] = useState<Detent>("peek");
  const [tabH, setTabH] = useState(58);
  const [searchOpen, setSearchOpen] = useState(false);
  const [net, setNet] = useState<Network | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const {
    sel,
    setSel,
    view,
    setView,
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
  } = useUrlState();
  // スマホで概念を選んでいる間は、ページを縦に送らない（地図は面の上いっぱいに合わせてある）。送れると下のタブと面が画面の途中に浮く（渡辺さん 2026-11-01）
  // 概念を選んでいる間は、どの幅でも関係図が画面いっぱいになり、詳しくは下からの面で出す（関係図に一本化。stats2-course #588。
  // 広い画面で面にしないと、詳しくが画面いっぱいの関係図の後ろに隠れた）
  const sheeted = narrow || !!sel;
  const locked = sheeted && !!sel && tab === "explore" && !exp;
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
  // 関係図で語をダブルタップしたときは、その語を選んで詳しくを全部の段で開く（下の effect が「少し」に戻さないよう印を置く）
  const openFull = useRef(false);
  useEffect(() => {
    setEdgeRaw(null);
    // 別の概念へ進んだら段2はそのまま（渡辺さん 2026-11-07「2段目を維持」。画面の原則 3）。フルからは段1へ
    const full = openFull.current; // 更新の関数はあとで呼ばれるので、印は先に読んでおく
    openFull.current = false;
    setDetent((d) => (full ? "full" : sel && d === "half" ? "half" : "peek"));
  }, [sel]); // 別の概念へ進んだら、線の説明は閉じる
  useEffect(() => {
    // 下のタブの高さ（詳しくの面はその上に乗る）
    const el = document.querySelector<HTMLElement>('[data-testid="tabbar"]');
    if (!el || typeof ResizeObserver !== "function") return;
    const ro = new ResizeObserver(() => setTabH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  });
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
  // 地図は関係図（stats2-course #588）：概念を選んでいればその概念の分類、選んでいなければ分類のページの「地図」で開いた分類
  const mapCat = concept ? concept.category : group && group !== "*" && layout === "map" ? group : undefined;

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
    return (
      <main className={st.app}>
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
          onConcept={(id) => net.concepts.has(id) && setSel(id)}
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
      </main>
    );
  }
  const sub = net.courses.map((c) => c.title).join("・");
  // 選んだ概念の分：下のタブに目印を出し、押すとその分に絞って開く（学ぶ行動は下のタブに。詳しくの面には置かない）
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
  const badges = focusBadges(net, focus);
  if (tab !== "explore")
    return (
      <main className={`${st.app} ${st.withTabs}`}>
        <Header title="知識ネットワーク" sub={sub} />
        {/* 概念から実験室・学習・問題集へ移ったときは、来た概念へ戻る ← を上に（下のタブだけにしない。UI レビュー「動線設計」2） */}
        {focus && (
          <button
            type="button"
            className={st.backTo}
            onClick={() => setTab("explore")} // 履歴を戻すのでなく探索のタブへ（URL で直接開いたときにサイトの外へ戻らない）
            data-testid="tab-back"
          >
            <span aria-hidden="true">←</span> {focus.name}
          </button>
        )}
        {tab === "learn" ? (
          <LearnPage net={net} focus={focus} />
        ) : tab === "lab" ? (
          <LabPage net={net} onOpen={setExp} focus={focus} />
        ) : (
          <ProblemsPage net={net} focus={focus} />
        )}
        <TabBar tab={tab} onTab={setTab} badges={badges} focusName={focus?.name} />
      </main>
    );
  const compact = sheeted && !!concept;
  return (
    <GlanceRoot
      net={net}
      current={concept?.id}
      onOpen={(id) => {
        setView("around");
        setSel(id);
      }}
    >
      <main className={`${st.app} ${st.withTabs}${edgeSel || modal ? ` ${st.withSheet} has-panel` : ""}`}>
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
                setSel(id);
              }}
            />
          ) : null}
          <Crumbs
            items={[
              // いちばん上はライブラリ（入口）。ライブラリ → 分類 → 語 の3段をパンくずで示す（UI レビュー「地図の変更で見直した点」1）
              ...(concept || group
                ? [
                    {
                      label: "ライブラリ",
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
                : group && group !== "*"
                  ? [{ label: group }]
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
        {!sel && (!group || group === "*") ? (
          <Library net={net} onConcept={setSel} onGroup={openGroup} />
        ) : !sel && layout !== "map" ? (
          <CategoryList net={net} category={group!} layout={layout} onConcept={setSel} />
        ) : mapCat ? (
          // 関係図（stats2-course #235・#588）：語を選んでも関係図のまま、下の面に詳しく（Detail）を出す
          <RelationMap
            key={mapCat}
            net={net}
            category={mapCat}
            selected={sel}
            onSelect={setSel}
            onOpen={(id) => {
              openFull.current = true;
              if (id === sel) setDetent("full");
              else setSel(id);
            }}
            onRelation={setEdgeSel}
            onOut={() => {
              setSel(null);
              setGroup(null, true);
            }}
            onCategory={() => {
              setSel(null);
              setGroup(mapCat!, true);
            }}
            onBlank={() => {
              const d = sheeted ? stepDown(detent) : null;
              if (d) setDetent(d);
              return !!d;
            }}
            step={detent}
          />
        ) : null}
        {concept ? (
          <Detail
            net={net}
            concept={concept}
            sheet={sheeted ? { detent, onDetent: setDetent, bottom: tabH } : undefined}
            onCompare={() => setModal("pick")}
            onSelect={setSel}
            onEdge={setEdgeSel}
            edgeSel={edgeSel}
            onQuestion={(x, q) => setExp(x, q)}
            onLab={() => setTab("lab")}
            onTrace={() => setView("path")}
            traceCount={seq.length}
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
            onClose={() => setView("around")}
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
            page={sheeted && !!concept && !tracing && detent === "full"}
            onQuestion={(x, q) => setExp(x, q)}
          />
        ) : null}
        {(sheeted && concept) || group ? null : (
          <Muted as="div" className={st.footer}>
            データ：各教材の公開した JSON（型 kn-schema v2）。教材の原本は各教材のリポジトリ。
          </Muted>
        )}
        <TabBar
          tab="explore"
          onTab={(t) => {
            if (t === "explore" && sel) setDetent(STEPS[0]!);
            else setTab(t);
          }}
          badges={badges}
          focusName={focus?.name}
        />
      </main>
    </GlanceRoot>
  );
}
