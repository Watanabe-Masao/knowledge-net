// 構造の見方の「並びを作ってみる」と「結果の並び」（Workspace.tsx から分けた。stats2-course #212）
import { useEffect, useState } from "react";
import { comb } from "@math-lab/engine";
import { haptic } from "../motion";
import { fmt } from "./shared";
import s from "../Workspace.module.css";

/** 並びを作ってみる（stats2-course issue 188 07b）：成功・失敗の札を押して並びを作り、その1通りの確率と、同じ成功の回数の並びの数を見る。
 *  どの並びも確率が同じ（独立で毎回 p）こと、並びの数が ₙCₖ であることを、自分で作った並びから確かめる。n が 10 より大きいときは作らない */
export function Sequence({ n, k, p }: { n: number; k: number; p: number }) {
  const [seq, setSeq] = useState<boolean[]>(() => Array.from({ length: n }, (_, i) => i < k));
  useEffect(() => {
    setSeq(Array.from({ length: n }, (_, i) => i < k));
  }, [n, k]);
  if (n > 10)
    return (
      <p className={s.hint} data-testid="ws-seq">
        n を 10 以下にすると、並びを自分で作れる。
      </p>
    );
  const succ = seq.filter(Boolean).length;
  const one = p ** succ * (1 - p) ** (n - succ);
  const c = comb(n, succ);
  return (
    <div className={s.seq} data-testid="ws-seq">
      <div className={s.seqHead}>
        <span className={s.muted}>並びを作ってみる（押すと成功・失敗が入れ替わる）</span>
        <b data-testid="ws-seq-count">成功 {succ} 回</b>
      </div>
      <div className={s.seqRow}>
        {seq.map((x, i) => (
          <button
            key={i}
            type="button"
            className={x ? `${s.seqItem} ${s.tint1}` : `${s.seqItem} ${s.tint2}`}
            aria-pressed={x}
            aria-label={`${i + 1} 回目：${x ? "成功" : "失敗"}`}
            onClick={() => {
              haptic();
              setSeq((q) => q.map((y, j) => (j === i ? !y : y)));
            }}
            data-testid={`ws-seq-${i}`}
          >
            {x ? "成" : "失"}
          </button>
        ))}
      </div>
      <p className={s.seqText}>
        この並びの確率 ＝ p<sup>{succ}</sup>(1−p)<sup>{n - succ}</sup> ＝{" "}
        <b data-testid="ws-seq-one" data-value={one}>
          {fmt(one, 5)}
        </b>
        <br />
        成功 {succ} 回の並びは、どれも同じ確率。並びは全部で{" "}
        <b data-testid="ws-seq-ways" data-value={c}>
          {n}C{succ} ＝ {c} 通り
        </b>
        {succ === k ? "（いまの k の棒）" : ""}
      </p>
    </div>
  );
}

/** 結果を全部ならべる（構造の補助。stats2-course issue 188）：n 回の成功・失敗の並び（2ⁿ 通り）を成功の回数ごとの行に分け、いまの k の行（＝事象に入る結果の集まり）を強く見せる。
 *  n が 5 より大きいと並べきれないので、n＝4 の小さい例で見せる（k は 4 まで） */
export function Outcomes({ n, k, p }: { n: number; k: number; p: number }) {
  const small = n > 5,
    m = small ? 4 : n,
    kk = Math.min(k, m);
  const rows = Array.from({ length: m + 1 }, () => [] as boolean[][]);
  for (let b = 0; b < 2 ** m; b++) {
    const q = Array.from({ length: m }, (_, i) => ((b >> (m - 1 - i)) & 1) === 1);
    rows[q.filter(Boolean).length]!.push(q);
  }
  const one = p ** kk * (1 - p) ** (m - kk),
    ways = rows[kk]!.length;
  return (
    <div className={s.outs} data-testid="ws-outs" data-n={m} data-k={kk}>
      <span className={s.muted}>
        {small ? `小さい例（n＝4・k＝${kk}）` : `n＝${m} の結果`}：全部で {2 ** m} 通り。成功の回数で行に分けた
      </span>
      {rows.map((r, j) => (
        <div
          key={j}
          className={s.outRow}
          data-on={j === kk || undefined}
          data-testid={`ws-outs-row-${j}`}
          data-count={r.length}
        >
          <span className={s.outLabel}>成功 {j}</span>
          <span className={s.outSeqs}>
            {r.map((q, i) => (
              <span key={i} className={s.outSeq}>
                {q.map((x, t) => (
                  <i key={t} data-x={x ? 1 : 0} />
                ))}
              </span>
            ))}
          </span>
        </div>
      ))}
      <p className={s.seqText}>
        「成功 {kk} 回」は行の {ways} 通りの集まり。どれも p<sup>{kk}</sup>(1−p)<sup>{m - kk}</sup>
        {small ? (
          ""
        ) : (
          <>
            {" "}
            ＝ <b data-testid="ws-outs-one">{fmt(one, 5)}</b>
          </>
        )}{" "}
        で同じなので、足すと {ways} × p<sup>{kk}</sup>(1−p)<sup>{m - kk}</sup>
      </p>
    </div>
  );
}
