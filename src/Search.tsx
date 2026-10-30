// 概念を探す（動的なドロップダウン）：押すと候補が下に開き、打つたびに絞り込む。名前・英語名の一致した所を強める。
// ↑↓ で選び Enter で開く、Esc で閉じる。説明のある概念を先に、まだ説明のない概念はあとに（薄く）。
import { useId, useMemo, useRef, useState } from "react";
import s from "./Search.module.css";
import type { Concept } from "./data";

type Props = { concepts: Concept[]; onPick: (id: string) => void };

const mark = (text: string, q: string) => {
  const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  return i < 0 ? text : <>{text.slice(0, i)}<b>{text.slice(i, i + q.length)}</b>{text.slice(i + q.length)}</>;
};

export default function Search({ concepts, onPick }: Props) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState(0);
  const list = useId();
  const input = useRef<HTMLInputElement>(null);
  const hits = useMemo(() => {
    const k = q.trim().toLowerCase();
    const m = concepts.filter((c) => !k || (c.name + " " + (c.en ?? "")).toLowerCase().includes(k));
    // 名前の頭で一致 → 説明のある概念 → 名前順
    return m.sort((a, b) => Number(!a.name.toLowerCase().startsWith(k)) - Number(!b.name.toLowerCase().startsWith(k))
      || Number(a.status === "stub") - Number(b.status === "stub") || a.name.localeCompare(b.name, "ja")).slice(0, 30);
  }, [q, concepts]);
  const pick = (id: string) => { onPick(id); setQ(""); setOpen(false); input.current?.blur(); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setAt((i) => Math.min(hits.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setAt((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter" && open && hits[at]) { e.preventDefault(); pick(hits[at]!.id); }
    else if (e.key === "Escape") setOpen(false);
  };
  return (
    <div className={s.root}>
      <input ref={input} type="search" className={s.field} placeholder="概念を探す（名前・英語名）" aria-label="概念を探す" value={q}
        role="combobox" aria-expanded={open} aria-controls={list} aria-autocomplete="list" aria-activedescendant={open && hits[at] ? `${list}-${at}` : undefined}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setAt(0); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)} onKeyDown={onKey} />
      {open && (
        <ul id={list} role="listbox" className={s.list} aria-label="候補">
          {hits.length ? hits.map((c, i) => (
            <li key={c.id} id={`${list}-${i}`} role="option" aria-selected={i === at} className={`${s.item}${c.status === "stub" ? ` ${s.stub}` : ""}`}
              onPointerDown={(e) => e.preventDefault()} onClick={() => pick(c.id)} onPointerEnter={() => setAt(i)}>
              <span className={s.name}>{mark(c.name, q.trim())}</span>
              {c.en && <span className={s.en}>{mark(c.en, q.trim())}</span>}
            </li>
          )) : <li className={s.none}>「{q}」に合う概念はない</li>}
        </ul>
      )}
    </div>
  );
}
