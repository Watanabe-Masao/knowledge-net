// 選んだ概念の説明：定義・原理・式（記号の意味）・条件・例・反例・誤解・つながり・単元・出典。
import { useEffect, useMemo, useRef, useState, type ReactNode, type PointerEvent as RPE } from "react";
import { Media, relationParts } from "./Relation";
import { RelDig, RelMap } from "./RelMap";
import {
  Bars,
  BottomSheet,
  Button,
  Card,
  Disclosure,
  Formula,
  Muted,
  Segmented,
  Workspace,
  TableWorkspace,
  type Detent,
} from "@math-lab/ui";
import { modelPmf, modelMoments } from "@math-lab/engine";
import katex from "katex";
import st from "./Detail.module.css";
import {
  KINDS,
  MODES,
  PREMISES,
  around,
  type Concept,
  type Formula as NetFormula,
  type Network,
  type Relation,
} from "./data";

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
  net: Network;
  concept: Concept;
  inCompare: boolean;
  onCompare: () => void;
  onSelect: (id: string) => void;
  /** つながりの行を押す（線を押したのと同じ。下からシートが開く） */
  onEdge: (id: string) => void;
  edgeSel?: string | null;
  /** この概念を主にする実験室の問いを開く（stats2-course #188 05：概念から実験へ） */
  onQuestion?: (experiment: string, question: string) => void;
  /** この概念で絞った実験室の一覧を開く（概念のページから実験室への入口は下の主ボタン1つ。渡辺さん 2026-11-04） */
  onLab?: () => void;
  /** スマホでは下からの面にする（段と、下のタブの高さ） */
  sheet?: { detent: Detent; onDetent: (d: Detent) => void; bottom: number; onPeek?: (h: number) => void };
};

type Tab = "about" | "formula" | "rel";

/** 使うことの少ない操作（比べる・共有）をまとめる「…」（CLAUDE.md「画面の決まり」：出しておく印は絞る） */
function MoreMenu({ items }: { items: { label: string; onClick: () => void; pressed?: boolean }[] }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const off = (e: Event) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    addEventListener("pointerdown", off);
    addEventListener("keydown", esc);
    return () => {
      removeEventListener("pointerdown", off);
      removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <div className={st.more} ref={box}>
      <Button
        variant="quiet"
        icon
        aria-label="ほかの操作"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="19" cy="12" r="1.6" />
        </svg>
      </Button>
      {open && (
        <div className={st.menu} role="menu">
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              aria-pressed={it.pressed}
              onClick={() => {
                setOpen(false);
                it.onClick();
              }}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const LAB_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
    <path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3" />
  </svg>
);
/** 開いて読む段（原理・条件・例と反例）。開いたら面を上まで上げる */
function More({ title, children, onOpen }: { title: ReactNode; children: ReactNode; onOpen: () => void }) {
  return (
    <details
      className={st.more2}
      onToggle={(e) => {
        if ((e.currentTarget as HTMLDetailsElement).open) onOpen();
      }}
    >
      <summary>{title}</summary>
      <div className={st.moreBody}>{children}</div>
    </details>
  );
}

const copyUrl = () => {
  try {
    void navigator.clipboard?.writeText(location.href);
  } catch {
    /* コピーできない環境 */
  }
};

/** つながりのまとまり（stats2-course #188 04）：前に知っておく → 姿を変えると → 比べる → この先で使う。行の文は gist（つまり）を先に */
type Group = {
  key: string;
  title: string;
  rows: { id: string; other: string; tag?: string; text: string; der?: boolean; label: string }[];
};
function groupsOf(net: Network, id: string): Group[] {
  const { relations, derivations } = around(net, id);
  const g: Record<string, Group> = {
    before: { key: "before", title: "前提", rows: [] },
    change: { key: "change", title: "変換", rows: [] },
    contrast: { key: "contrast", title: "対比", rows: [] },
    after: { key: "after", title: "応用", rows: [] },
  };
  for (const r of relations) {
    const other = r.from === id ? r.to : r.from;
    const tag = r.mode ? MODES[r.mode]!.split("（")[0] : r.type === "前提" ? undefined : r.type; // 札は短く（極限・近似・厳密）
    const row = {
      id: r.id,
      other: name(net, other),
      tag,
      text: r.gist ?? r.description ?? relationParts(net, r).text,
      label: relationParts(net, r).text,
    }; // 前提は gist がないので、どこで使うかの説明（description）
    const k = r.type === "変換" ? "change" : r.type === "対比" ? "contrast" : r.to === id ? "before" : "after";
    if (row.tag === g[k]!.title) row.tag = undefined; // 見出しと同じ札は省く（「対比」の下の全行に「対比」と出さない。UI レビュー「重複と量」）
    g[k]!.rows.push(row);
  }
  for (const d of derivations)
    (d.conclusion === id ? g.before : g.after)!.rows.push({
      id: d.id,
      other: d.conclusion === id ? d.premises.map((p) => name(net, p)).join("・") : name(net, d.conclusion),
      tag: "導出",
      text: d.statement,
      der: true,
      label: d.statement,
    });
  return Object.values(g).filter((x) => x.rows.length);
}

export default function Detail({
  net,
  concept: c,
  inCompare,
  onCompare,
  onSelect,
  onEdge,
  edgeSel,
  onQuestion,
  onLab,
  sheet,
}: Props) {
  // 「少し」の段の高さ：見出し・定義・学ぶ行動がちょうど見える高さ（中身の量で変わるので測る）
  const headRef = useRef<HTMLDivElement>(null);
  const [peekH, setPeekH] = useState(240);
  useEffect(() => {
    const el = headRef.current;
    if (!el || typeof ResizeObserver !== "function") return;
    const ro = new ResizeObserver(() => setPeekH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [sheet !== undefined]); // eslint-disable-line react-hooks/exhaustive-deps
  // 「少し」の段：見出し（名前の1行と切り替え）＋ 定義が見える高さ
  const leadRef = useRef<HTMLDivElement>(null);
  const [leadH, setLeadH] = useState(80);
  useEffect(() => {
    const el = leadRef.current;
    if (!el || typeof ResizeObserver !== "function") return;
    const ro = new ResizeObserver(() => setLeadH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  });
  const peekOut = sheet
    ? Math.max(
        140,
        Math.min(peekH + leadH + 36, Math.round((typeof innerHeight === "number" ? innerHeight : 800) * 0.42)),
      )
    : 0;
  useEffect(() => {
    if (sheet) sheet.onPeek?.(peekOut);
  }, [peekOut]); // eslint-disable-line react-hooks/exhaustive-deps
  const groups = groupsOf(net, c.id);
  const units = c.units.map((u) => net.units.get(u)).filter((u) => !!u);
  // 面の作り（渡辺さん 2026-10-31「スライドで見る部分が狭い」・11-01「下のツールバーに動的に」）：
  // 動かない見出しは「名前の1行」と切り替え（概要・式・つながり）だけ。中身は面の残り全部で指で送る。
  // 学ぶ行動（実験室・問題・単元）は下のタブが選んだ概念の分に絞って開く（同じ機能を2か所に置かない）
  const hasFormula = !!(c.workspace || c.formulas?.length);
  const tabs: { value: Tab; label: string }[] = [
    { value: "about", label: "概要" },
    ...(hasFormula ? [{ value: "formula" as Tab, label: "式" }] : []),
    { value: "rel", label: "関係" },
  ];
  const [tabRaw, setTabRaw] = useState<Tab>("about");
  // 読むときは全画面（地図を隠す）。切り替えや開く行に触ったら面を上まで上げる（stats2-course #188 02）
  const reading = () => {
    if (sheet && sheet.detent !== "full") sheet.onDetent("full");
  };
  const setTab = (t: Tab) => {
    setTabRaw(t);
    reading();
  };
  // 少しの段で中身に触れたら、読むために上まで上げる（押した所の操作はそのまま）
  // 押す所（問いの札・開く段・ボタン）は、その操作をそのまま通す（全画面のページに切り替えると、押した所が入れ替わって押しても効かなかった。#188 07a）
  const touch = (e: RPE) => {
    if ((e.target as HTMLElement).closest("button, a, summary, input, select")) return;
    if (sheet && (sheet.detent === "peek" || sheet.detent === "min")) reading();
  };
  // この概念を主にする実験室の問い（問いの側で一元管理。#163）
  const qs = useMemo(
    () =>
      [...net.experiments.values()].flatMap((x) =>
        ("catalog" in x ? (x.catalog ?? []) : [])
          .flatMap((g) => g.items)
          .filter((it) => !it.retired && it.open && it.concept === c.id)
          .map((it) => ({ x: x.id, id: it.id, title: it.title })),
      ),
    [net, c.id],
  );
  const [pick, setPick] = useState<string | null>(null); // つながりの地図で選んだつながり
  useEffect(() => {
    setPick(null);
  }, [c.id]);
  const chart = useMemo(() => {
    if (c.chart?.kind !== "binom") return null;
    const m = { kind: "binom" as const, n: c.chart.n ?? 10, p: c.chart.p ?? 0.5 };
    const pmf = modelPmf(m),
      mean = modelMoments(m).mean,
      hi = pmf.reduce((b, v, i) => (v > pmf[b]! + 1e-12 ? i : b), 0);
    return { m, pmf, mean, hi };
  }, [c.chart]);
  const mainF = c.workspace ? c.formulas?.[c.workspace.formula] : c.formulas?.[0];
  const tab = tabs.some((t) => t.value === tabRaw) ? tabRaw : "about";
  // 作業台に出している式（主役・期待値・変換）は、下の一覧に重ねて出さない（同じものを2か所に置かない。#156）
  const used = new Set(
    [
      c.workspace?.formula,
      c.workspace?.mean,
      c.workspace?.linear,
      c.table_workspace?.formula,
      c.table_workspace?.linear,
    ].filter((x): x is number => x !== undefined),
  );
  const others = (c.formulas ?? []).map((f, i) => [f, i] as const).filter(([, i]) => !used.has(i));
  const formulaList = others.length ? (
    <Disclosure
      summary={used.size ? `ほかの式（${others.length}）` : `式（${others.length}）`}
      data-testid="more-formulas"
      open={!used.size}
    >
      {others.map(([f, i]) => (
        <Formula
          key={i}
          formula={keyed(f)}
          editable
          onConcept={(id) => net.concepts.has(id) && onSelect(id)}
          conceptName={(id) => name(net, id)}
          definitions={(id) => (net.concepts.get(id)?.formulas ?? []).map(keyed)}
        />
      ))}
      <Muted>記号を押すと意味が出る。「開く」でその記号の定義の式に置き換わる。値を入れると1段ずつ計算できる。</Muted>
    </Disclosure>
  ) : null;
  const head = (
    <>
      <header className={st.head}>
        {sheet?.detent === "full" && (
          <button
            type="button"
            className={st.back}
            onClick={() => sheet.onDetent("peek")}
            data-testid="detail-to-map"
            aria-label="地図へ戻る"
          >
            ←
          </button>
        )}
        <div className={st.titles}>
          <h2>{c.name}</h2>
          <Muted as="div" className={st.kicker}>
            {[c.category, units.map((u) => `U${u!.number}`).join(" ")].filter(Boolean).join("・")}
            {c.status === "stub" ? "・まだ説明がない" : ""}
          </Muted>
        </div>
        <MoreMenu
          items={[
            { label: inCompare ? "比較の面を開く" : "ほかの概念と比較", onClick: onCompare, pressed: inCompare },
            { label: "この概念の URL をコピー", onClick: copyUrl },
          ]}
        />
      </header>
      <div className={st.tabs}>
        <Segmented variant="tabs" value={tab} onChange={(v) => v && setTab(v as Tab)} label="概念の中身" items={tabs} />
      </div>
    </>
  );
  const rest = (
    <>
      {tab === "about" && (
        <div className={st.pane} data-testid="tab-about" onPointerDown={touch}>
          {/* 概要の情報階層（stats2-course #188 02）：問い → つまり → 図 → 定義を最初の画面に。原理・条件・例と反例・誤解は開いて読む */}
          <div ref={leadRef} className={st.lead}>
            {/* 問いは概念の問いの文だけ。実験室への入口は下の主ボタン1つ（同じ機能を2か所に置かない。渡辺さん 2026-11-04） */}
            {c.question && (
              <section className={st.ask} data-testid="concept-question">
                <span className={st.lab}>問い</span>
                <p className={st.askText}>{c.question}</p>
              </section>
            )}
            {c.gist && (
              <section className={st.block} data-testid="concept-gist">
                <span className={st.lab}>つまり</span>
                <p className={st.gist}>{c.gist}</p>
              </section>
            )}
            {!c.gist && c.short && c.definition ? (
              <p className={st.short} data-testid="concept-short">
                {c.short}
              </p>
            ) : null}
          </div>
          {chart && (
            <section className={st.block} data-testid="concept-chart">
              <div className={st.labRow}>
                <span className={st.lab}>図</span>
                <Muted as="span">
                  n＝{chart.m.n}・p＝{Math.round(chart.m.p * 100)}%
                </Muted>
              </div>
              <Bars
                theory={chart.pmf}
                hi={chart.hi}
                marker={chart.mean}
                height={130}
                label={`成功の回数ごとの確率（n＝${chart.m.n}・p＝${Math.round(chart.m.p * 100)}%）。いちばん高いのは ${chart.hi} 回`}
              />
              {c.chart?.note && <p className={st.note}>{c.chart.note}</p>}
            </section>
          )}
          {(c.definition || c.short) && (
            <section className={st.block}>
              <span className={st.lab}>定義</span>
              <p className={st.definition}>{c.definition ?? c.short}</p>
              {/* 定義の段では式を見せるだけ（記号を押して開くのは「式」の切り替えの作業台で） */}
              {mainF?.tex && (
                <div
                  className={st.defTex}
                  data-testid="concept-def-tex"
                  dangerouslySetInnerHTML={{
                    __html: katex.renderToString(mainF.tex, { throwOnError: false, displayMode: true }),
                  }}
                />
              )}
              {c.status === "skeleton" && (
                <p className={st.skeleton} data-testid="skeleton-note">
                  定義だけ：今は定義1文と分類まで。原理・条件・例・式は、単元を進めるときに足す
                </p>
              )}
            </section>
          )}
          <Media figures={c.figures} labs={c.labs} context="concept" open={false} />
          {c.principle && (
            <More title="なぜその形か（原理）" onOpen={reading}>
              <p>{c.principle}</p>
            </More>
          )}
          {c.conditions && (
            <More
              title={
                <>
                  成り立つ条件{" "}
                  <span className={st.n}>
                    {c.conditions.math.length}
                    {c.conditions.data?.length ? `＋データ ${c.conditions.data.length}` : ""}
                  </span>
                </>
              }
              onOpen={reading}
            >
              <h4>式が成り立つ条件</h4>
              <ul className={st.conds}>
                {c.conditions.math.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
              {c.conditions.data?.length ? (
                <>
                  <h4>データで確認すること</h4>
                  <ul>
                    {c.conditions.data.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </>
              ) : null}
            </More>
          )}
          {c.example || c.counterexample || c.misconceptions?.length ? (
            <More title="例と反例・よくある誤解" onOpen={reading}>
              {(c.example || c.counterexample) && (
                <div className={st.pair}>
                  {c.example && (
                    <div>
                      <b className={st.ok}>例</b>
                      <p>{c.example}</p>
                    </div>
                  )}
                  {c.counterexample && (
                    <div>
                      <b className={st.ng}>反例</b>
                      <p>{c.counterexample}</p>
                      <Media labs={c.counterexample_labs} context="counterexample" />
                    </div>
                  )}
                </div>
              )}
              {c.misconceptions?.length ? (
                <ul className={st.misconceptions}>
                  {c.misconceptions.map((m, i) => (
                    <li key={m.misconception}>
                      <Card as="div" tone="inset">
                        <span className={st.wrong}>
                          <span className={st.ng}>✗</span> {m.misconception}
                        </span>
                        <p>
                          <span className={st.ok}>○</span> {m.correction}
                        </p>
                        <Media labs={m.labs} context={`misconception-${i}`} />
                      </Card>
                    </li>
                  ))}
                </ul>
              ) : null}
            </More>
          ) : null}
          {c.sources?.length ? (
            <Muted>
              出典：
              {c.sources.map((s, i) => (
                <span key={s.title}>
                  {i ? "・" : ""}
                  {s.url ? (
                    <a href={s.url} target="_blank" rel="noreferrer">
                      {s.title}
                    </a>
                  ) : (
                    s.title
                  )}
                  {s.locator ? `（${s.locator}）` : ""}
                </span>
              ))}
            </Muted>
          ) : null}
          <Muted as="div" className={st.idLine}>
            {c.id}・版 {c.version}
          </Muted>
        </div>
      )}
      {tab === "formula" && (
        <div className={st.pane} data-testid="tab-formula">
          {c.table_workspace && c.formulas?.[c.table_workspace.formula]?.tree && (
            <TableWorkspace
              key={c.id}
              tables={c.table_workspace.tables}
              formula={keyed(c.formulas[c.table_workspace.formula]!)}
              linear={c.table_workspace.linear !== undefined ? keyed(c.formulas[c.table_workspace.linear]!) : undefined}
              definitions={(id) => (net.concepts.get(id)?.formulas ?? []).map(keyed)}
              onConcept={(id) => net.concepts.has(id) && onSelect(id)}
              conceptName={(id) => name(net, id)}
            />
          )}
          {c.workspace && c.formulas?.[c.workspace.formula]?.tree && (
            <Workspace
              formula={keyed(c.formulas[c.workspace.formula]!)}
              mean={c.workspace.mean !== undefined ? keyed(c.formulas[c.workspace.mean]!) : undefined}
              linear={c.workspace.linear !== undefined ? keyed(c.formulas[c.workspace.linear]!) : undefined}
              vary={c.workspace.vary}
              over={c.workspace.over}
              definitions={(id) => (net.concepts.get(id)?.formulas ?? []).map(keyed)}
              onConcept={(id) => net.concepts.has(id) && onSelect(id)}
              conceptName={(id) => name(net, id)}
            />
          )}
          {formulaList}
        </div>
      )}
      {tab === "rel" && (
        <div className={st.pane} data-testid="tab-rel">
          {groups.length ? (
            <>
              {/* つながりの地図（#188 07c）：点を押すと、そのつながりを下に「問い → 段」で掘る。一覧の行を押すと全画面で開く */}
              <RelMap
                center={c.name}
                groups={groups}
                sel={pick}
                onSel={(id) => setPick((x) => (x === id ? null : id))}
              />
              {pick ? (
                <RelDig net={net} id={pick} onOpen={onEdge} onClose={() => setPick(null)} />
              ) : (
                <Muted as="p" className={st.digHint}>
                  点を押すと、その関係を問いと段階に沿って掘り下げる。
                </Muted>
              )}
              <div data-testid="edge-list">
                {groups.map((g) => (
                  <section key={g.key} data-testid={`rel-group-${g.key}`}>
                    <h3 className={st.groupTitle}>{g.title}</h3>
                    <ul className={st.rels}>
                      {g.rows.map((r) => (
                        <li key={r.id} data-testid={`${r.der ? "der" : "rel"}-${r.id}`}>
                          {/* 読み上げは関係の文（「二項分布 を変換すると ポアソン分布」）。見た目は相手の名前とつまりを先に */}
                          <button
                            type="button"
                            className={st.rel}
                            aria-pressed={edgeSel === r.id}
                            onClick={() => onEdge(r.id)}
                            aria-label={`${r.label}。${r.text}`}
                          >
                            <span className={st.relText}>
                              {r.other}
                              {r.tag && <span className={st.relTag}>{r.tag}</span>}
                            </span>
                            <span className={st.relGist}>{r.text}</span>
                            <span className={st.relChev} aria-hidden="true">
                              ›
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            </>
          ) : (
            <Muted>まだ関係がない。</Muted>
          )}
          <Muted>押すと、関係のページが開く。グラフの線を押すのと同じ。</Muted>
        </div>
      )}
    </>
  );
  if (!sheet)
    return (
      <Card data-testid="detail">
        {head}
        {rest}
      </Card>
    );
  // 読むときは面を重ねず全画面のページ（実験室と同じ骨組み：上に「←・題・…」、中は指で送る、下に次の1手。stats2-course #188 07a・#194）
  if (sheet.detent === "full") {
    const lab = qs.length > 0 && onLab;
    return (
      <section
        className={st.page}
        data-testid="detail"
        data-detent="full"
        role="region"
        aria-label={`${c.name} のページ`}
      >
        <div className={st.pageHead}>{head}</div>
        <div className={st.pageBody}>{rest}</div>
        {lab && (
          <div className={st.pageBar}>
            <Button variant="primary" className={st.pageCta} onClick={onLab} data-testid="page-cta">
              {LAB_ICON} 実験室で検証
            </Button>
          </div>
        )}
      </section>
    );
  }
  const peek = peekOut;
  // スマホ：地図の上に重なる下からの面。見出し・切り替え・定義が「少し」の段で見え、広げると面の残り全部で中身を送る（#42）
  return (
    <BottomSheet
      label={`${c.name} の詳しく`}
      data-testid="detail"
      detent={sheet.detent}
      onDetent={sheet.onDetent}
      bottom={sheet.bottom}
      peek={peek}
      min={84}
      header={<div ref={headRef}>{head}</div>}
    >
      {rest}
    </BottomSheet>
  );
}
