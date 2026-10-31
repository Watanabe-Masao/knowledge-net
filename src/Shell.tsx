// サイトの骨組み（stats2-course #42・#130）：ヘッダー・パンくず・下のタブ4つと、学習・実験室・問題集の入口の一覧。
// タブは URL の ?t= に持つ（探索は付けない）。一覧は教材の JSON だけから作る（教材の原本は読まない）。
// 個人の記録（解いた・お気に入り）は持たない。単元と問題は Notion のページへのリンク。
import type { ReactNode } from "react";
import { Muted } from "@math-lab/ui";
import type { Network } from "./data";
import s from "./Shell.module.css";

export type Tab = "explore" | "learn" | "lab" | "problems";
export const TABS: { id: Tab; label: string }[] = [
  { id: "explore", label: "探索" }, { id: "learn", label: "学習" }, { id: "lab", label: "実験室" }, { id: "problems", label: "問題集" },
];
export const readTab = (p: URLSearchParams): Tab => (p.get("x") ? "lab" : (TABS.find((t) => t.id === p.get("t"))?.id ?? "explore"));

/** 線で描く小さな印（絵文字は使わない） */
export function Icon({ name, size = 22 }: { name: Tab | "search" | "chevron" | "out"; size?: number }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  switch (name) {
    case "explore": return <svg {...p}><circle cx="6" cy="7" r="2.6" /><circle cx="18" cy="6" r="2.6" /><circle cx="12" cy="18" r="2.6" /><path d="M8.5 7.5l7-1M7.2 9.3l3.6 6.4M16.8 8.4l-3.6 7.3" /></svg>;
    case "learn": return <svg {...p}><path d="M3 5h7a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H3zM21 5h-7a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h7z" /></svg>;
    case "lab": return <svg {...p}><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3" /></svg>;
    case "problems": return <svg {...p}><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 12l3 3 5-6" /></svg>;
    case "search": return <svg {...p}><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>;
    case "chevron": return <svg {...p}><path d="M9 6l6 6-6 6" /></svg>;
    case "out": return <svg {...p}><path d="M7 17L17 7M9 7h8v8" /></svg>;
  }
}

export function Header({ title, sub, children }: { title: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <header className={s.header}>
      <div className={s.brand}>
        <span className={s.logo}><Icon name="explore" size={20} /></span>
        <div className={s.titles}><h1>{title}</h1>{sub ? <div className={s.sub}>{sub}</div> : null}</div>
      </div>
      {children}
    </header>
  );
}

/** いまいる所：分類 › 概念。分類を押すとその分類の地図へ */
export function Crumbs({ items }: { items: { label: string; onClick?: () => void }[] }) {
  if (!items.length) return null;
  return (
    <nav className={s.crumbs} aria-label="いまいる所" data-testid="crumbs">
      {items.map((it, i) => (
        <span key={i} className={s.crumb}>
          {i ? <span className={s.sep}><Icon name="chevron" size={14} /></span> : null}
          {it.onClick && i < items.length - 1 ? <button type="button" onClick={it.onClick}>{it.label}</button> : <b aria-current={i === items.length - 1 ? "page" : undefined}>{it.label}</b>}
        </span>
      ))}
    </nav>
  );
}

export function TabBar({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  return (
    <nav className={s.tabs} aria-label="タブ" data-testid="tabbar">
      {TABS.map((t) => (
        <a key={t.id} href={t.id === "explore" ? "?" : `?t=${t.id}`} aria-current={tab === t.id ? "page" : undefined}
          onClick={(e) => { e.preventDefault(); onTab(t.id); }}>
          <span className={s.tabIcon}><Icon name={t.id} /></span>{t.label}
        </a>
      ))}
    </nav>
  );
}

/** 学習：単元の一覧。押すと Notion の単元ページ（読んで、自分のメモを書き足す所） */
export function LearnPage({ net }: { net: Network }) {
  const units = [...net.units.values()];
  const labUnits = labsByUnit(net);
  return (
    <section className={s.page} data-testid="page-learn">
      <h2 className={s.pageTitle}>学習</h2>
      <Muted>単元のページは Notion で読み、自分のメモを書き足す。</Muted>
      <ul className={s.list}>
        {units.map((u) => (
          <li key={u.id}>
            <a className={s.row} href={u.url} target="_blank" rel="noreferrer" aria-disabled={!u.url}>
              <span className={s.num}>{u.number}</span>
              <span className={s.rowText}>{u.title}{labUnits.get(u.id)?.length ? <small>実験室：{labUnits.get(u.id)!.join("・")}</small> : null}</span>
              {u.url ? <span className={s.out} aria-label="Notion で開く"><Icon name="out" size={16} /></span> : null}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** 実験室：問いから選ぶ一覧 */
export function LabPage({ net, onOpen }: { net: Network; onOpen: (id: string) => void }) {
  const xs = [...net.experiments.values()];
  return (
    <section className={s.page} data-testid="page-lab">
      <h2 className={s.pageTitle}>実験室</h2>
      <Muted>予想してから、自分で起こして確かめる。</Muted>
      <ol className={s.stages} aria-label="実験室の段">{["予測", "実験", "観察", "理由", "応用", "比べる"].map((x, i) => <li key={x}><i>{i + 1}</i>{x}</li>)}</ol>
      <ul className={s.cards}>
        {xs.map((x) => (
          <li key={x.id}>
            <button type="button" className={s.labCard} onClick={() => onOpen(x.id)}>
              <span className={s.labTag}>{x.title.replace(/\s*実験室$/, "")}</span>
              <b>{x.question}</b>
              <Muted as="span">場面 {x.themes.length}・反例 {x.counterexamples?.length ?? 0}</Muted>
            </button>
          </li>
        ))}
      </ul>
      {!xs.length ? <Muted>実験室はまだない。</Muted> : null}
    </section>
  );
}

/** 問題集：単元ごとの、概念とつないだ問題の数。押すと Notion の単元ページ（問題を解き、記録は Notion の解答記録へ） */
export function ProblemsPage({ net }: { net: Network }) {
  const byUnit = new Map<string, Set<string>>();
  for (const c of net.concepts.values()) for (const q of c.problems) {
    const m = /Q-(U[\w]+?)-\d+$/.exec(q);
    if (!m) continue;
    const uid = [...net.units.keys()].find((k) => k.endsWith(`:${m[1]}`));
    if (uid) (byUnit.get(uid) ?? byUnit.set(uid, new Set()).get(uid)!).add(q);
  }
  const units = [...net.units.values()].filter((u) => byUnit.has(u.id));
  return (
    <section className={s.page} data-testid="page-problems">
      <h2 className={s.pageTitle}>問題集</h2>
      <Muted>押すと Notion の単元ページの問題へ。解いた記録は Notion の解答記録に残す（このサイトは記録を持たない）。</Muted>
      <ul className={s.list}>
        {units.map((u) => (
          <li key={u.id}>
            <a className={s.row} href={u.url} target="_blank" rel="noreferrer">
              <span className={s.num}>{u.number}</span>
              <span className={s.rowText}>{u.title}<small>概念とつないだ問題 {byUnit.get(u.id)!.size}</small></span>
              <span className={s.out} aria-label="Notion で開く"><Icon name="out" size={16} /></span>
            </a>
          </li>
        ))}
      </ul>
      {!units.length ? <Muted>概念とつないだ問題はまだない。</Muted> : null}
    </section>
  );
}

/** 単元 → その単元の概念につながる実験室の名前 */
function labsByUnit(net: Network) {
  const m = new Map<string, string[]>();
  for (const x of net.experiments.values()) {
    const units = new Set((x.links.concepts ?? []).flatMap((id) => net.concepts.get(id)?.units.slice(0, 1) ?? []));
    for (const u of units) (m.get(u) ?? m.set(u, []).get(u)!).push(x.title.replace(/\s*実験室$/, ""));
  }
  return m;
}
