// 経路の「順に読む」（stats2-course #42：渡辺さん 2026-10-31「経路が前提になってます」）。
// 経路の見方では、詳しくの代わりに、選んだ概念までの前提を学ぶ順（地図の番号と同じ）に並べる。
// 行を押すとその場で概要を開き、「開く」でその概念をフォーカスで開く。最後の行は選んだ概念（ここ）。スマホでは地図に重なる下からの面
import { useEffect, useState } from "react";
import { BottomSheet, Card, type Detent } from "@math-lab/ui";
import type { Network } from "./data";
import st from "./PathList.module.css";

// 画面の言葉（渡辺さん 2026-11-01「骨格の意味が伝わりにくい」）：データの状態 skeleton は「定義だけ」と出す
const STATUS: Record<string, string> = { filled: "説明あり", skeleton: "定義だけ", stub: "まだ" };

type Props = {
  net: Network; target: string; seq: string[];
  onOpen: (id: string) => void;
  sheet?: { detent: Detent; onDetent: (d: Detent) => void; bottom: number; onPeek?: (h: number) => void };
};

/** 「少し」の段：見出しと最初の2行が見える高さ */
export const PATH_PEEK = 200;

export default function PathList({ net, target, seq, onOpen, sheet }: Props) {
  const rows = [...seq, target].filter((id) => net.concepts.has(id));
  const count = (k: string) => seq.filter((id) => net.concepts.get(id)?.status === k).length;
  const summary = [["filled", count("filled")], ["skeleton", count("skeleton")], ["stub", count("stub")]].filter(([, n]) => n).map(([k, n]) => `${STATUS[k as string]} ${n}`).join("・");
  useEffect(() => { sheet?.onPeek?.(PATH_PEEK); }, [sheet !== undefined]);   // eslint-disable-line react-hooks/exhaustive-deps
  const head = (
    <div className={st.head}>
      <b>順に読む</b>
      <span>{seq.length ? summary : "たどれる前提はない"}</span>
    </div>
  );
  // 行を押すと、その場で概要を開く（アコーディオン。1つずつ）。画面を移らないので順に追える。詳しく見たいときは「開く」で移る（渡辺さん 2026-11-01）
  const [open, setOpen] = useState<string | null>(null);
  const list = (
    <ol className={st.list} aria-label="学ぶ順">
      {rows.map((id, i) => {
        const c = net.concepts.get(id)!, here = id === target, on = open === id;
        const text = c.short ?? c.definition;
        return (
          <li key={id}>
            <button type="button" className={st.row} data-testid={`path-row-${id}`} onClick={() => setOpen(on ? null : id)} aria-expanded={on} aria-controls={`path-${i}`} aria-current={here ? "step" : undefined}>
              <span className={st.no} aria-hidden="true">{here ? "★" : i + 1}</span>
              <span className={st.name}>{c.name}</span>
              <span className={st.status}>{here ? "ここ" : STATUS[c.status]}</span>
              <span className={`${st.chev}${on ? ` ${st.chevOn}` : ""}`} aria-hidden="true">›</span>
            </button>
            {on ? (
              <div className={st.panel} id={`path-${i}`} data-testid={`path-panel-${id}`}>
                {c.category ? <span className={st.meta}>{c.category}{c.en ? `・${c.en}` : ""}</span> : null}
                {text ? <p>{text}</p> : <p className={st.meta}>説明はまだない。</p>}
                {c.principle ? <p className={st.sub}>{c.principle}</p> : null}
                <button type="button" className={st.go} onClick={() => onOpen(id)}>{c.name} を開く<span aria-hidden="true">›</span></button>
              </div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
  if (!sheet) return <Card data-testid="trace">{head}{list}</Card>;
  return (
    <BottomSheet label="順に読む" data-testid="trace" detent={sheet.detent} onDetent={sheet.onDetent} bottom={sheet.bottom}
      peek={PATH_PEEK} min={84} header={head}>
      {list}
    </BottomSheet>
  );
}
