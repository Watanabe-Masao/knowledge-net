// 経路の「順に読む」（stats2-course #42：渡辺さん 2026-10-31「経路が前提になってます」）。
// 経路の見方では、詳しくの代わりに、選んだ概念までの前提を学ぶ順（地図の番号と同じ）に並べる。
// 行を押すとその概念をフォーカスで開く。最後の行は選んだ概念（ここ）。スマホでは地図に重なる下からの面
import { useEffect } from "react";
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
  const list = (
    <ol className={st.list} aria-label="学ぶ順">
      {rows.map((id, i) => {
        const c = net.concepts.get(id)!, here = id === target;
        return (
          <li key={id}>
            <button type="button" className={st.row} onClick={() => onOpen(id)} aria-current={here ? "step" : undefined}>
              <span className={st.no} aria-hidden="true">{here ? "★" : i + 1}</span>
              <span className={st.name}>{c.name}</span>
              <span className={st.status}>{here ? "ここ" : STATUS[c.status]}</span>
            </button>
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
