// 選んだ概念の説明：定義・原理・式（記号の意味）・条件・例・反例・誤解・つながり・単元・出典。
import { useEffect, useRef, useState } from "react";
import { Badges, Media, relationParts } from "./Relation";
import { BottomSheet, Button, Card, Disclosure, Formula, Muted, Segmented, Workspace, TableWorkspace, type Detent } from "@math-lab/ui";
import st from "./Detail.module.css";
import { KINDS, MODES, PREMISES, around, type Concept, type Formula as NetFormula, type Network, type Relation } from "./data";

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
  net: Network; concept: Concept; inCompare: boolean;
  onCompare: () => void; onSelect: (id: string) => void;
  /** つながりの行を押す（線を押したのと同じ。下からシートが開く） */
  onEdge: (id: string) => void; edgeSel?: string | null;
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
    const off = (e: Event) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    addEventListener("pointerdown", off); addEventListener("keydown", esc);
    return () => { removeEventListener("pointerdown", off); removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <div className={st.more} ref={box}>
      <Button variant="quiet" icon aria-label="ほかの操作" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>
      </Button>
      {open && <div className={st.menu} role="menu">
        {items.map((it) => <button key={it.label} type="button" role="menuitem" aria-pressed={it.pressed} onClick={() => { setOpen(false); it.onClick(); }}>{it.label}</button>)}
      </div>}
    </div>
  );
}

const copyUrl = () => { try { void navigator.clipboard?.writeText(location.href); } catch { /* コピーできない環境 */ } };

export default function Detail({ net, concept: c, inCompare, onCompare, onSelect, onEdge, edgeSel, sheet }: Props) {
  // 「少し」の段の高さ：見出し・定義・学ぶ行動がちょうど見える高さ（中身の量で変わるので測る）
  const headRef = useRef<HTMLDivElement>(null);
  const [peekH, setPeekH] = useState(240);
  useEffect(() => {
    const el = headRef.current;
    if (!el || typeof ResizeObserver !== "function") return;
    const ro = new ResizeObserver(() => setPeekH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [sheet !== undefined]);   // eslint-disable-line react-hooks/exhaustive-deps
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
  const peekOut = sheet ? Math.max(140, Math.min(peekH + leadH + 36, Math.round((typeof innerHeight === "number" ? innerHeight : 800) * 0.42))) : 0;
  useEffect(() => { if (sheet) sheet.onPeek?.(peekOut); }, [peekOut]);   // eslint-disable-line react-hooks/exhaustive-deps
  const { relations, derivations } = around(net, c.id);
  const units = c.units.map((u) => net.units.get(u)).filter((u) => !!u);
  // 面の作り（渡辺さん 2026-10-31「スライドで見る部分が狭い」・11-01「下のツールバーに動的に」）：
  // 動かない見出しは「名前の1行」と切り替え（概要・式・つながり）だけ。中身は面の残り全部で指で送る。
  // 学ぶ行動（実験室・問題・単元）は下のタブが選んだ概念の分に絞って開く（同じ機能を2か所に置かない）
  const hasFormula = !!(c.workspace || c.formulas?.length);
  const tabs: { value: Tab; label: string }[] = [
    { value: "about", label: "概要" },
    ...(hasFormula ? [{ value: "formula" as Tab, label: "式" }] : []),
    { value: "rel", label: "つながり" },
  ];
  const [tabRaw, setTab] = useState<Tab>("about");
  const tab = tabs.some((t) => t.value === tabRaw) ? tabRaw : "about";
  const formulaList = c.formulas?.length ? (
    <Disclosure summary={`式（${c.formulas.length}）`} data-testid="more-formulas" open={!(c.workspace || c.table_workspace)}>
      {c.formulas.map((f, i) => (
        <Formula key={i} formula={keyed(f)} editable onConcept={(id) => net.concepts.has(id) && onSelect(id)} conceptName={(id) => name(net, id)}
          definitions={(id) => (net.concepts.get(id)?.formulas ?? []).map(keyed)} />
      ))}
      <Muted>記号を押すと意味が出る。「開く」でその記号の定義の式に置き換わる。値を入れると1段ずつ計算できる。</Muted>
    </Disclosure>
  ) : null;
  const head = <>
      <header className={st.head}>
        <div className={st.titles}>
          <h2>{c.name}</h2>
          <Muted as="div" className={st.kicker}>{[c.category, units.map((u) => `U${u!.number}`).join(" ")].filter(Boolean).join("・")}{c.status === "stub" ? "・まだ説明がない" : ""}</Muted>
        </div>
        <MoreMenu items={[
          { label: inCompare ? "比べる面を開く" : "ほかの概念と比べる", onClick: onCompare, pressed: inCompare },
          { label: "この概念の URL をコピー", onClick: copyUrl },
        ]} />
      </header>
      <div className={st.tabs}>
        <Segmented value={tab} onChange={(v) => v && setTab(v as Tab)} label="概念の中身" items={tabs} />
      </div>
  </>;
  const rest = <>
      {tab === "about" && <div className={st.pane} data-testid="tab-about">
        <div ref={leadRef}>
          {c.en ? <Muted as="div" className={st.en}>{c.en}</Muted> : null}
          {c.definition ? <p className={st.definition}>{c.definition}</p> : c.short ? <p className={st.definition}>{c.short}</p> : null}
          {c.status === "skeleton" && <p className={st.skeleton} data-testid="skeleton-note">定義だけ：今は定義1文と分類まで。原理・条件・例・式は、単元を進めるときに足す</p>}
        </div>
        <Media figures={c.figures} labs={c.labs} context="concept" open={!c.workspace} />
        {c.principle && <section><h3>原理</h3><p>{c.principle}</p></section>}
        {c.conditions && <section><h3>成り立つ条件</h3>
          <ul>{c.conditions.math.map((x) => <li key={x}>{x}</li>)}</ul>
          {c.conditions.data?.length ? <><h4>データに当てはめるとき</h4><ul>{c.conditions.data.map((x) => <li key={x}>{x}</li>)}</ul></> : null}
        </section>}
        {(c.example || c.counterexample) && <section><h3>具体例と反例</h3>
          {c.example && <p><b>例</b>　{c.example}</p>}
          {c.counterexample && <><p><b>反例</b>　{c.counterexample}</p><Media labs={c.counterexample_labs} context="counterexample" /></>}
        </section>}
        {c.misconceptions?.length ? <section><h3>よくある誤解（{c.misconceptions.length}）</h3>
          <ul className={st.misconceptions}>{c.misconceptions.map((m, i) => (
            <li key={m.misconception}><Card as="div" tone="inset"><span className={st.wrong}>✕ {m.misconception}</span><p>→ {m.correction}</p><Media labs={m.labs} context={`misconception-${i}`} /></Card></li>))}</ul>
        </section> : null}
        {c.sources?.length ? <Muted>出典：{c.sources.map((s) => (s.url ? <a key={s.title} href={s.url} target="_blank" rel="noreferrer">{s.title}</a> : s.title))}{c.sources[0].locator ? `（${c.sources[0].locator}）` : ""}</Muted> : null}
        <Muted as="div" className={st.idLine}>{c.id}・版 {c.version}</Muted>
      </div>}
      {tab === "formula" && <div className={st.pane} data-testid="tab-formula">
        {c.table_workspace && c.formulas?.[c.table_workspace.formula]?.tree && (
          <TableWorkspace key={c.id} tables={c.table_workspace.tables} formula={keyed(c.formulas[c.table_workspace.formula]!)}
            linear={c.table_workspace.linear !== undefined ? keyed(c.formulas[c.table_workspace.linear]!) : undefined}
            definitions={(id) => (net.concepts.get(id)?.formulas ?? []).map(keyed)}
            onConcept={(id) => net.concepts.has(id) && onSelect(id)} conceptName={(id) => name(net, id)} />
        )}
        {c.workspace && c.formulas?.[c.workspace.formula]?.tree && (
          <Workspace formula={keyed(c.formulas[c.workspace.formula]!)} mean={c.workspace.mean !== undefined ? keyed(c.formulas[c.workspace.mean]!) : undefined}
            vary={c.workspace.vary} over={c.workspace.over} definitions={(id) => (net.concepts.get(id)?.formulas ?? []).map(keyed)}
            onConcept={(id) => net.concepts.has(id) && onSelect(id)} conceptName={(id) => name(net, id)} />
        )}
        {formulaList}
      </div>}
      {tab === "rel" && <div className={st.pane} data-testid="tab-rel">
        {relations.length + derivations.length ? (
          <ul className={st.rels} data-testid="edge-list">
            {relations.map((r) => (
              <li key={r.id} data-testid={`rel-${r.id}`}>
                <button type="button" className={st.rel} aria-pressed={edgeSel === r.id} onClick={() => onEdge(r.id)}>
                  <Badges net={net} r={r} />
                  <span className={st.relText}>{relationParts(net, r).text}</span>
                  {r.gist && <span className={st.relGist}>{r.gist}</span>}
                </button>
              </li>
            ))}
            {derivations.map((d) => (
              <li key={d.id} data-testid={`der-${d.id}`}>
                <button type="button" className={st.rel} aria-pressed={edgeSel === d.id} onClick={() => onEdge(d.id)}>
                  <span className={st.derTag}>導出</span>
                  <span className={st.relText}>{d.statement}</span>
                  <span className={st.relGist}>前提：{d.premises.map((p) => name(net, p)).join("・")}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : <Muted>まだつながりがない。</Muted>}
        <Muted>押すと、下から説明（図・解説・触る）が開く。グラフの線を押すのと同じ。</Muted>
      </div>}
  </>;
  if (!sheet) return <Card data-testid="detail">{head}{rest}</Card>;
  const peek = peekOut;
  // スマホ：地図の上に重なる下からの面。見出し・切り替え・定義が「少し」の段で見え、広げると面の残り全部で中身を送る（#42）
  return (
    <BottomSheet label={`${c.name} の詳しく`} data-testid="detail" detent={sheet.detent} onDetent={sheet.onDetent} bottom={sheet.bottom}
      peek={peek} min={84} header={<div ref={headRef}>{head}</div>}>
      {rest}
    </BottomSheet>
  );
}
