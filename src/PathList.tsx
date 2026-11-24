// 前提をさかのぼる（stats2-course #587・#588 B2。渡辺さん 2026-11-23）：選んだ概念を学ぶ前に、何をどの順に学べばよいか。
// 関係図は1つの分類の中の横のつながり（製本 ⑤）、ここは分類をまたぐ学ぶ順（製本 ⑥。教材の learning_order）。
// 読むものなので全画面のページ（画面の原則 20）。遠い前提から学ぶ順に並べ、行ごとに分類を添える。最後の行は選んだ概念。
// 行を押すと、その概念を関係図と概念のページで開く。← で閉じると、来た概念に戻る。
import { useEffect } from "react";
import { FullView, subText } from "@math-lab/ui";
import { type Network, lead } from "./data";
import st from "./PathList.module.css";

// 画面の言葉（渡辺さん 2026-11-01「骨格の意味が伝わりにくい」）：データの状態 skeleton は「定義だけ」と出す
const STATUS: Record<string, string> = {
  heading: "文脈の見出し",
  skeleton: "定義だけ",
  stub: "まだ",
};

type Props = {
  net: Network;
  target: string;
  /** 学ぶ順（遠い前提から）。選んだ概念は含まない */
  seq: string[];
  onOpen: (id: string) => void;
  onClose: () => void;
};

/** 一覧ごとに、最後に開いた行（同じタブの中だけ。戻ったらその行が見える所から出す。画面の原則 3・stats2-course の issue 595） */
const opened = new Map<string, string>();

export default function PathList({ net, target, seq, onOpen, onClose }: Props) {
  useEffect(() => {
    const id = opened.get(target);
    if (!id) return;
    document.querySelector(`[data-testid="path-row-${id}"]`)?.scrollIntoView({ block: "center" });
  }, [target]);
  const here = net.concepts.get(target)!;
  const rows = [...seq, target].filter((id) => net.concepts.has(id));
  const cats = new Set(seq.map((id) => net.concepts.get(id)?.category).filter(Boolean));
  let no = 0;
  return (
    <FullView label="前提をさかのぼる" title={`${here.name}の前提`} onClose={onClose}>
      <div className={st.page} data-testid="trace">
        <p className={st.lead}>
          {seq.length
            ? `${here.name}を学ぶ前に読む ${seq.length} の概念（${cats.size} の分類）。遠い前提から学ぶ順に並べた。`
            : `${here.name}には、たどれる前提がない。`}
        </p>
        {/* 学ぶ順は分類をまたいで行き来するので、分類で区切らず行ごとに分類を添える（区切ると見出しがほぼ1行ごとに並んだ） */}
        <ol className={st.list} aria-label="学ぶ順">
          {rows.map((id) => {
            const c = net.concepts.get(id)!,
              me = id === target;
            if (!me) no += 1;
            const text = c.gist ?? lead(c);
            return (
              <li key={id}>
                <button
                  type="button"
                  className={st.row}
                  data-testid={`path-row-${id}`}
                  aria-current={me ? "step" : undefined}
                  onClick={() => {
                    opened.set(target, id);
                    onOpen(id);
                  }}
                >
                  <span className={st.no} aria-hidden="true">
                    {me ? "" : no}
                  </span>
                  <span className={st.body}>
                    <span className={st.name}>
                      {c.name}
                      {me ? <span className={st.me}>この概念</span> : null}
                    </span>
                    <span className={st.meta}>{[c.category, STATUS[c.status]].filter(Boolean).join("・")}</span>
                    {text ? <span className={st.text}>{subText(text)}</span> : null}
                  </span>
                  <span className={st.chev} aria-hidden="true">
                    ›
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </FullView>
  );
}
