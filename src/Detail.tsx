// 選んだ概念の説明：定義・原理・式（記号の意味）・条件・例・反例・誤解・つながり・単元・出典。
import { useEffect, useMemo, useRef, useState, type ReactNode, type Ref } from "react";
import { Media, relationParts } from "./Relation";
import { RelDig, RelMap } from "./RelMap";
import {
  Button,
  Card,
  Disclosure,
  Formula,
  Muted,
  Segmented,
  Workspace,
  TableWorkspace,
  subPlain,
  subText,
} from "@math-lab/ui";
import katex from "katex";
import st from "./Detail.module.css";
import { kindName, readingOf } from "./kinds";
import Conditions, { conditionCount } from "./Conditions";
import Claims from "./Claims";
import { chartSvg } from "./conceptChart";
import { useGlance, Words } from "./Glance";
import { ConceptLabs, labsFor } from "./Shell";
import {
  kindOf,
  MODES,
  around,
  claimsOf,
  headingsOf,
  type Concept,
  type Formula as NetFormula,
  type Network,
  type Relation,
} from "./data";

/** 画面の型（key が任意）から部品の型へ（key のない記号は木から指せないので落とす） */
const keyed = (f: NetFormula) => ({ ...f, symbols: f.symbols?.flatMap((x) => (x.key ? [{ ...x, key: x.key }] : [])) });

export function name(net: Network, id: string): string {
  const c = net.concepts.get(id);
  if (c) return c.name;
  // 関係の id（問いの主が関係のとき）は、両端の名前と種類で呼ぶ。id を画面に出さない（画面の原則 14。stats2-course #379）
  const r = net.relations.find((x) => x.id === id);
  return r
    ? `${net.concepts.get(r.from)?.name ?? r.from} と ${net.concepts.get(r.to)?.name ?? r.to}（${kindName(r.type)}）`
    : id;
}

/** 関係を「□は■の前提」のような文にする。 */
export function sentence(net: Network, r: Relation): string {
  const k = kindOf(r.type);
  const s = readingOf(r.type, k?.reading).replace("□", name(net, r.from)).replace("■", name(net, r.to));
  const tag = r.mode ? `（${MODES[r.mode]}）` : "";
  return s + tag;
}

type Props = {
  net: Network;
  concept: Concept;
  onCompare: () => void;
  onSelect: (id: string) => void;
  /** つながりの行を押す（線を押したのと同じ。下からシートが開く） */
  onEdge: (id: string) => void;
  edgeSel?: string | null;
  /** 実験室を開く（問いを選んでいれば、その問いを直接。stats2-course #188 05：概念から実験へ） */
  onQuestion?: (experiment: string, question: string | null) => void;
  /** 前提をさかのぼる（全画面の一覧）を開く。数は分類をまたぐ学ぶ順でたどれる前提の数（stats2-course #588 B2） */
  onTrace?: () => void;
  traceCount?: number;
  /** 路線図の次の駅（stats2-course の issue 592 の段 3）。押すとその概念のページ */
  next?: { id: string; name: string };
  onNext?: (id: string) => void;
  /** この概念の分類の関係図に降りる（面の段2。ページの関係の段から） */
  onMap?: () => void;
  /** スマホでは下からの面にする（段と、下のタブの高さ） */
  /** 見出しの ←：1つ前のページへ（ページを積む形。issue 599） */
  onBack: () => void;
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
/** 開いて読む段（原理・条件・例と反例） */
function More({
  title,
  children,
  detailsRef,
  testId,
}: {
  title: ReactNode;
  children: ReactNode;
  detailsRef?: Ref<HTMLDetailsElement>;
  testId?: string;
}) {
  return (
    <details className={st.more2} ref={detailsRef} data-testid={testId}>
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
export type Group = {
  key: string;
  /** つながりの地図（RelMap）のどの側に置くか。見出しは細かく分け、地図の側は4つのまま（地図の描き直しは issue 249 のあと） */
  side: "before" | "change" | "contrast" | "after";
  title: string;
  /** kind：種類の短い名前（地図で同じ相手の点に札を並べるときに使う。見出しが種類を言う行でも残す） */
  rows: { id: string; other: string; tag?: string; kind?: string; text: string; der?: boolean; label: string }[];
};
function groupsOf(net: Network, id: string): Group[] {
  const { relations, derivations } = around(net, id);
  // 見出しの呼び名と向き（stats2-course issue 249 ④）：A のページは「定義に使う概念」、使われる側の B のページは「これを定義に使う概念」
  const g: Record<string, Group> = {
    // 一種の親（⑤ の一種。今の画面では種類）：親の定義が子の定義に入るので、定義に使う概念と同じ上の側（渡辺さん 2026-11-09）
    kindof: { key: "kindof", side: "before", title: "何の一種か", rows: [] },
    // 特別な場合（⑤）も一種と同じ考え方：一般の側が上、特別な場合が下（渡辺さん 2026-11-09 のスクリーンショットから。応用に落ちていた）
    specof: { key: "specof", side: "before", title: "何の特別な場合か", rows: [] },
    def: { key: "def", side: "before", title: "定義に使う概念", rows: [] },
    know: { key: "know", side: "before", title: "前提知識", rows: [] },
    from: { key: "from", side: "before", title: "何から導けるか", rows: [] },
    basis: { key: "basis", side: "before", title: "何が根拠か", rows: [] },
    before: { key: "before", side: "before", title: "これを導く定理の点", rows: [] },
    follows: { key: "follows", side: "change", title: "何に従うか", rows: [] },
    estimates: { key: "estimates", side: "change", title: "何を推定するか", rows: [] },
    change: { key: "change", side: "change", title: "移る", rows: [] },
    equiv: { key: "equiv", side: "change", title: "同値", rows: [] },
    contrast: { key: "contrast", side: "contrast", title: "比べる", rows: [] },
    used: { key: "used", side: "after", title: "これを定義に使う概念", rows: [] },
    // 前提知識の逆の側（このページの概念を前提知識にする概念）。応用に落ちていた（stats2-course の issue 266：学ぶ順の足すが増えて見えた）
    knownby: { key: "knownby", side: "after", title: "これを前提知識にする概念", rows: [] },
    kinds: { key: "kinds", side: "after", title: "この一種", rows: [] },
    specs: { key: "specs", side: "after", title: "この特別な場合", rows: [] },
    followedby: { key: "followedby", side: "after", title: "これに従うもの", rows: [] },
    estimatedby: { key: "estimatedby", side: "after", title: "これを推定するもの", rows: [] },
    derives: { key: "derives", side: "after", title: "これから導けるもの", rows: [] },
    grounds: { key: "grounds", side: "after", title: "これを根拠にするもの", rows: [] },
    after: { key: "after", side: "after", title: "これを使う定理の点", rows: [] },
  };
  // ⑤ の種類（と学ぶ順の足す）ごとに、このページの概念が to の側か from の側かで見出しを決める（stats2-course #267 M7-1）
  const PLACE: Record<string, [into: string, out: string]> = {
    一種: ["kinds", "kindof"],
    特別な場合: ["specs", "specof"],
    定める: ["def", "used"],
    前提知識: ["know", "knownby"],
    移る: ["change", "change"],
    同値: ["equiv", "equiv"],
    従う: ["followedby", "follows"],
    推定する: ["estimatedby", "estimates"],
    導ける: ["from", "derives"],
    根拠: ["basis", "grounds"],
    比べる: ["contrast", "contrast"],
  };
  for (const r of relations) {
    const other = r.from === id ? r.to : r.from;
    // 札は移るの厳密・近似・極限だけ（短く）。種類は見出しが言っている
    const tag: string | undefined = r.mode ? MODES[r.mode]!.split("（")[0] : undefined;
    const row = {
      id: r.id,
      other: name(net, other),
      tag,
      kind: kindName(r.type),
      text: r.gist ?? r.description ?? relationParts(net, r).text,
      label: relationParts(net, r).text,
    }; // 前提知識は gist がないので、どこで使うかの説明（description）
    const into = r.to === id;
    const place = PLACE[r.type];
    const k = place ? (into ? place[0] : place[1]) : into ? "before" : "after";
    g[k]!.rows.push(row);
  }
  for (const d of derivations)
    (d.conclusion === id ? g.before : g.after)!.rows.push({
      id: d.id,
      other: d.conclusion === id ? d.premises.map((p) => name(net, p)).join("・") : name(net, d.conclusion),
      tag: "定理の点",
      text: d.statement,
      der: true,
      label: d.statement,
    });
  return Object.values(g).filter((x) => x.rows.length);
}

export default function Detail({
  net,
  concept: c,
  onCompare,
  onSelect,
  onEdge,
  edgeSel,
  onQuestion,
  onTrace,
  traceCount,
  next,
  onNext,
  onMap,
  onBack,
}: Props) {
  // 「少し」の段の高さ：見出し・定義・学ぶ行動がちょうど見える高さ（中身の量で変わるので測る）
  // 読むときは全画面のページ1本（概要 → 式 → 関係 → 試す → 次の駅）。切り替えはその段へ送る目次（stats2-course の issue 592 の段 2。渡辺さん 2026-11-24）。
  // 前は地図の上の下からの面（段1・段2・フル）だったが、issue 599 でページを積む形にして外した
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
  // 目次：その段の頭へ送る（1本のページの中の位置。画面の原則 3：戻ると離れたときのまま、は送った位置で保つ）
  const restRef = useRef<HTMLDivElement>(null);
  const jump = (t: Tab | "lab") =>
    requestAnimationFrame(() =>
      restRef.current?.querySelector(`[data-testid=tab-${t}]`)?.scrollIntoView({ block: "start" }),
    );
  // 目次の選びは、読んでいる段に合わせる（送るだけで替わる。押した段と見えている段を食い違わせない）
  useEffect(() => {
    const body = restRef.current?.parentElement;
    if (!body) return;
    const on = () => {
      const top = body.getBoundingClientRect().top + 80;
      let cur: Tab = "about";
      for (const t of ["about", "formula", "rel"] as Tab[]) {
        const el = restRef.current?.querySelector(`[data-testid=tab-${t}]`);
        if (el && el.getBoundingClientRect().top <= top) cur = t;
      }
      setTabRaw((x) => (x === cur ? x : cur));
    };
    body.addEventListener("scroll", on, { passive: true });
    return () => body.removeEventListener("scroll", on);
  }, [c.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // 試すの段に出す実験室があるか（この概念を主か関連に持つ問い・つなぐ概念。段の中身は ConceptLabs）
  const hasLabs = useMemo(() => labsFor(net, c.id).length > 0, [net, c.id]);
  const [pick, setPick] = useState<string | null>(null); // つながりの地図で選んだつながり
  useEffect(() => {
    setPick(null);
  }, [c.id]);
  // 概要の図（stats2-course #577 D1・D2・D3a）。設定は教材の静止図と同じ名前で、math-lab の描く関数に渡す
  const chart = useMemo(() => {
    return c.chart ? chartSvg(c.chart) : null;
  }, [c.chart]);
  const mainF = c.workspace ? c.formulas?.[c.workspace.formula] : c.formulas?.[0];
  // 文の下の語の札は、ひと目を開く（ページを替えない。stats2-course #593）。ひと目の外では前のとおりページへ
  const glance = useGlance();
  const onWord = glance ?? onSelect;
  const cl = useMemo(() => claimsOf(net, c.id), [net, c.id]);
  // この概念について言える主張のうち、条件（仮定）の行を持つものの数（成立条件から主張の欄への入口に出す）
  const assumed = cl.about.filter((x) => (x.conditions_detail?.length ?? x.conditions?.length ?? 0) > 0).length;
  const claimsBox = useRef<HTMLDetailsElement>(null);
  const openClaims = () => {
    const d = claimsBox.current;
    if (!d) return;
    d.open = true;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    d.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    d.querySelector("summary")?.focus({ preventScroll: true });
  };
  const heads = useMemo(() => headingsOf(net, c.id), [net, c.id]);
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
        <button type="button" className={st.back} onClick={onBack} data-testid="detail-to-map" aria-label="戻る">
          ←
        </button>
        <div className={st.titles}>
          <h2>{c.name}</h2>
          <Muted as="div" className={st.kicker}>
            {[c.category, units.map((u) => `U${u!.number}`).join(" ")].filter(Boolean).join("・")}
            {c.status === "stub" ? "・まだ説明がない" : ""}
          </Muted>
        </div>
        <MoreMenu
          items={[
            { label: "ほかの概念と比べる", onClick: onCompare },
            { label: "この概念の URL をコピー", onClick: copyUrl },
          ]}
        />
      </header>
      <div className={st.tabs}>
        <Segmented
          variant="tabs"
          value={tab}
          onChange={(v) => {
            if (!v) return;
            setTabRaw(v as Tab);
            jump(v as Tab);
          }}
          label="概念の中身"
          items={tabs}
        />
      </div>
    </>
  );
  // 問いとつまり（概要の頭）
  const leadBlock = (
    <div className={st.lead}>
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
          <p className={st.gist}>{subText(c.gist)}</p>
        </section>
      )}
      {!c.gist && c.short && c.definition ? (
        <p className={st.short} data-testid="concept-short">
          {subText(c.short)}
        </p>
      ) : null}
    </div>
  );
  const rest = (
    <div ref={restRef} className={st.rest}>
      <div className={st.pane} data-testid="tab-about">
        {/* 概要の情報階層（stats2-course #188 02）：問い → つまり → 図 → 定義を最初の画面に。原理・条件・例と反例・誤解は開いて読む */}
        {leadBlock}
        {chart && (
          <section className={st.block} data-testid="concept-chart">
            <div className={st.labRow}>
              <span className={st.lab}>図</span>
              <Muted as="span">{chart.params}</Muted>
            </div>
            {/* 静止図（Notion の画像）と同じ関数・同じ設定で描く（stats2-course の issue 582 の D0）。色は画面の変数で、暗い画面に合わせる */}
            <div
              className={st.drawn}
              dangerouslySetInnerHTML={{
                __html: chart.svg,
              }}
            />
            {c.chart?.note && <p className={st.note}>{c.chart.note}</p>}
          </section>
        )}
        {/* 文脈の見出し（製本 ① の 2。stats2-course の issue 302）：自分の定義を持たないので、定義の代わりに共有する概念との対応と、対象・文脈の違いを出す。
              定義・式・成立条件は共有する概念のページで読む（重ねて出さない。画面の原則 8） */}
        {c.heading_of && (
          <section className={st.block} data-testid="concept-heading">
            <span className={st.lab}>文脈の見出し</span>
            <p className={st.definition}>{subText(c.heading_of.correspondence)}</p>
            <dl className={st.headingDiff}>
              <dt>対象の違い</dt>
              <dd>{c.heading_of.object_diff}</dd>
              <dt>文脈の違い</dt>
              <dd>{c.heading_of.context_diff}</dd>
              {/* 文脈ごとの構造（型 v2 の改訂7。stats2-course の issue 475）：取り方と H₀ を文と同じ段に。成立条件は下の開いて読む段 */}
              {c.heading_of.context && (
                <>
                  <dt>取り方</dt>
                  <dd data-testid="heading-sampling">{c.heading_of.context.sampling}</dd>
                  <dt>帰無仮説 H₀</dt>
                  <dd data-testid="heading-h0">{subText(c.heading_of.context.null_hypothesis.text)}</dd>
                </>
              )}
            </dl>
            {net.concepts.has(c.heading_of.concept) && (
              <Button
                variant="quiet"
                className={st.headingTo}
                onClick={() => onSelect(c.heading_of!.concept)}
                data-testid="heading-shared"
              >
                定義・式・{c.heading_of.context ? "共通の" : ""}成立条件は「{name(net, c.heading_of.concept)}」で読む ›
              </Button>
            )}
          </section>
        )}
        {c.heading_of?.context?.conditions?.length ? (
          <More
            title={
              <>
                この文脈の成立条件 <span className={st.n}>{c.heading_of.context.conditions.length}</span>
              </>
            }
          >
            <Conditions
              net={net}
              detail={c.heading_of.context.conditions}
              math={[]}
              onTerm={onWord}
              plainClass={st.conds}
              testId="heading-conditions"
            />
          </More>
        ) : null}
        {(c.definition || c.short) && (
          <section className={st.block}>
            <span className={st.lab}>定義</span>
            <p className={st.definition}>{subText(c.definition ?? c.short)}</p>
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
            {/* つまりと定義に出る語（何だっけ。#593）。つまりの下に並べると、問い → つまり → 図 → 定義 の順を崩す */}
            <Words net={net} text={`${c.gist ?? ""} ${c.definition ?? c.short ?? ""}`} self={c.id} />
          </section>
        )}
        {/* 見出しは定義のあと（概要の情報階層 stats2-course の issue 188 02 を崩さない）。行は名前だけ（対応の文は見出しのページで読む） */}
        {heads.length > 0 && (
          <section className={st.block} data-testid="concept-headings">
            <span className={st.lab}>文脈の見出し</span>
            <Muted as="p">同じ意味を、別の対象・文脈で呼ぶ名前。</Muted>
            <ul className={st.headingList}>
              {heads.map((h) => (
                <li key={h.id}>
                  <Button variant="quiet" className={st.headingTo} onClick={() => onSelect(h.id)}>
                    {h.name} ›
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )}
        <Media figures={c.figures} labs={c.labs} context="concept" open={false} />
        {c.principle && (
          <More title="なぜその形か（原理）">
            <p>{subText(c.principle)}</p>
            <Words net={net} text={c.principle} self={c.id} />
          </More>
        )}
        {/* 要件の行がなく（math が空。仮定は主張の側。stats2-course #532）手掛かりもない概念には、空の段を置かない */}
        {c.conditions &&
          (c.conditions.math.length > 0 ||
            (c.conditions.data?.length ?? 0) > 0 ||
            (c.conditions_detail?.length ?? 0) > 0) && (
            <More
              title={
                <>
                  成立条件{" "}
                  <span className={st.n}>
                    {conditionCount(c.conditions_detail, c.conditions.math, c.conditions.data)}
                  </span>
                </>
              }
            >
              <Conditions
                net={net}
                detail={c.conditions_detail}
                math={c.conditions.math}
                data={c.conditions.data ?? []}
                onTerm={onWord}
                plainClass={st.conds}
              />
              {/* 仮定（保証の条件）は、その概念について言える主張の側にある（stats2-course の issue 532 C で概念から移した）。成立条件だけを読むと
                  仮定が見えないので、主張の欄への入口を置く（画面の原則 13。押すとその欄を開いて見せる：原則 11。渡辺さん 2026-11-26） */}
              {assumed > 0 && (
                <Button variant="quiet" className={st.headingTo} onClick={openClaims} data-testid="cond-to-claims">
                  仮定（保証の条件）は主張の欄に（{assumed}） ›
                </Button>
              )}
            </More>
          )}
        {(cl.about.length > 0 || cl.uses.length > 0) && (
          <More
            detailsRef={claimsBox}
            testId="concept-claims"
            title={
              <>
                主張 <span className={st.n}>{cl.about.length + cl.uses.length}</span>
              </>
            }
          >
            <Claims net={net} self={c.id} about={cl.about} uses={cl.uses} onTerm={onWord} />
          </More>
        )}
        {c.example || c.counterexample || c.misconceptions?.length ? (
          <More title="例と反例・よくある誤解">
            {(c.example || c.counterexample) && (
              <div className={st.pair}>
                {c.example && (
                  <div>
                    <b className={st.ok}>例</b>
                    <p>{subText(c.example)}</p>
                    <Words net={net} text={c.example} self={c.id} />
                  </div>
                )}
                {c.counterexample && (
                  <div>
                    <b className={st.ng}>反例</b>
                    <p>{subText(c.counterexample)}</p>
                    <Words net={net} text={c.counterexample} self={c.id} />
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
                      <Words net={net} text={`${m.misconception} ${m.correction}`} self={c.id} />
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
      <div className={st.pane} data-testid="tab-formula">
        <h3 className={st.paneTitle}>式</h3>
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
            initial={c.workspace.initial}
            definitions={(id) => (net.concepts.get(id)?.formulas ?? []).map(keyed)}
            onConcept={(id) => net.concepts.has(id) && onSelect(id)}
            conceptName={(id) => name(net, id)}
          />
        )}
        {formulaList}
      </div>
      <div className={st.pane} data-testid="tab-rel">
        <h3 className={st.paneTitle}>関係</h3>
        {/* 前提をさかのぼる（stats2-course の issue 588 の B2）：分類をまたぐ学ぶ順。関係の行と同じ部品で、押すと全画面の一覧。
              関係図で見る（issue 592 の段 3）：ホームは路線図になったので、分類の関係図にはここから降りる */}
        {(onTrace && traceCount) || onMap ? (
          <ul className={st.rels}>
            {onMap && (
              <li>
                <button type="button" className={st.rel} onClick={onMap} data-testid="map-open">
                  <span className={st.relText}>関係図で見る</span>
                  <span className={st.relGist}>{`${c.category ?? "この分類"}の概念と関係を、地図で見る`}</span>
                  <span className={st.relChev} aria-hidden="true">
                    ›
                  </span>
                </button>
              </li>
            )}
            {onTrace && traceCount ? (
              <li>
                <button type="button" className={st.rel} onClick={onTrace} data-testid="trace-open">
                  <span className={st.relText}>前提をさかのぼる</span>
                  <span className={st.relGist}>{`学ぶ前に読む ${traceCount} の概念を、学ぶ順に並べる`}</span>
                  <span className={st.relChev} aria-hidden="true">
                    ›
                  </span>
                </button>
              </li>
            ) : null}
          </ul>
        ) : null}
        {groups.length ? (
          <>
            {/* つながりの地図（#188 07c）：点を押すと、そのつながりを下に「問い → 段」で掘る。一覧の行を押すと全画面で開く */}
            <RelMap center={c.name} groups={groups} sel={pick} onSel={(id) => setPick((x) => (x === id ? null : id))} />
            {pick ? (
              <RelDig
                net={net}
                id={pick}
                center={c.id}
                onOpen={onEdge}
                onConcept={onSelect}
                onClose={() => setPick(null)}
              />
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
                          aria-label={`${r.label}。${subPlain(r.text)}`}
                        >
                          <span className={st.relText}>
                            {r.other}
                            {r.tag && <span className={st.relTag}>{r.tag}</span>}
                          </span>
                          <span className={st.relGist}>{subText(r.text)}</span>
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
      {/* 試す（issue 599）：この概念を使う実験室の問い。前は別のページ（実験室の一覧）だった。全画面のページだけに置く */}
      {onQuestion && hasLabs && (
        <div className={st.pane} data-testid="tab-lab">
          <h3 className={st.paneTitle}>試す</h3>
          <ConceptLabs net={net} id={c.id} onOpen={(x, q) => onQuestion(x, q ?? null)} />
        </div>
      )}
      {/* 次の駅（路線図の次。ページのいちばん下＝読み終えた所に置く。画面の原則 9：次の1手を示す） */}
      {next && onNext && (
        <button type="button" className={st.nextStation} onClick={() => onNext(next.id)} data-testid="next-station">
          <span className={st.nextLab}>次の駅</span>
          <span className={st.nextName}>{next.name}</span>
          <span className={st.relChev} aria-hidden="true">
            ›
          </span>
        </button>
      )}
    </div>
  );
  const lab = hasLabs && !!onQuestion;
  return (
    <section
      className={st.page}
      data-testid="detail"
      data-detent="full"
      role="region"
      aria-label={`${c.name} のページ`}
    >
      {/* 上のつまみは外した：戻るは見出しの ← 1つ（ページを積む形。stats2-course の issue 599） */}
      <div className={st.pageHead}>{head}</div>
      <div className={st.pageBody}>{rest}</div>
      {lab && (
        <div className={st.pageBar}>
          <Button variant="primary" className={st.pageCta} onClick={() => jump("lab")} data-testid="page-cta">
            {LAB_ICON} 実験室で検証
          </Button>
        </div>
      )}
    </section>
  );
}
