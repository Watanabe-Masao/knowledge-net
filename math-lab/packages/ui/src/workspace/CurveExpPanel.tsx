// 9 実験（パターン3＝連続の分布。stats2-course の issue 608）：分布から値を引き、塗った区間に入った割合を、塗った面積（理論の確率）と並べる。
// ヒストグラムは図（CurveChart）の曲線に重ねる。手触りはパターン1の実験（ExpPanel）と同じ：押すとすぐ走るボタン・記録は閉じた「記録」の中・消す前に一度たずねる
import { useState } from "react";
import { fmt, minus } from "./shared";
import type { WsCtx } from "./ctx";
import s from "../Workspace.module.css";

export function CurveExpPanel({ w }: { w: WsCtx }) {
  const c = w.curve!;
  const { samples: xs, lastSample, runSamples, clearSamples, seed, inRegion, prob, meanValue } = c;
  const [asking, setAsking] = useState(false);
  const hit = xs.filter(inRegion).length;
  const mean = xs.length ? xs.reduce((t, x) => t + x, 0) / xs.length : undefined;
  return (
    <div className={s.exp} data-testid="ws-exp">
      <div className={s.expRow}>
        <b>実験する</b>
        <div className={s.expBtns}>
          <button type="button" className={s.expBtn} onClick={() => runSamples(1)} data-testid="ws-run-1">
            1回引く
          </button>
          <button type="button" className={s.expBtn} onClick={() => runSamples(100)} data-testid="ws-run-100">
            100回引く
          </button>
          <button type="button" className={s.expBtn} onClick={() => runSamples(1000)} data-testid="ws-run-1000">
            1000回引く
          </button>
        </div>
      </div>
      <p className={s.expStat} data-testid="ws-exp-stat" data-hit={hit} data-n={xs.length} aria-live="polite">
        {xs.length ? (
          <>
            実験 <b>{xs.length}</b> 回
            {lastSample !== null && (
              <>
                （今回 <b>{minus(fmt(lastSample, 3))}</b>）
              </>
            )}
            ・塗った区間に入った <b>{hit}</b> 回＝<b>{fmt((hit / xs.length) * 100, 1)}%</b>（面積 {fmt(prob * 100, 1)}
            %）・平均 <b>{minus(fmt(mean, 2))}</b>
            {meanValue !== undefined && <>（理論 {minus(fmt(meanValue, 2))}）</>}
          </>
        ) : (
          <>まだ実験していない。回数を増やすと、柱が曲線に、入った割合が面積に近づくかを見る。</>
        )}
      </p>
      <details className={s.expFoot} data-testid="ws-exp-more">
        <summary>記録</summary>
        <p className={s.expSeed}>乱数の種 {seed}（同じ種なら同じ結果になる）</p>
        {asking ? (
          <div className={s.expAsk} role="group" aria-label="記録を消す">
            <span>{xs.length} 回の記録を消す？</span>
            <button
              type="button"
              className={s.clear}
              onClick={() => {
                clearSamples();
                setAsking(false);
              }}
              data-testid="ws-clear-yes"
            >
              消す
            </button>
            <button type="button" className={s.clear} onClick={() => setAsking(false)}>
              やめる
            </button>
          </div>
        ) : (
          <button
            type="button"
            className={s.clear}
            onClick={() => setAsking(true)}
            disabled={!xs.length}
            data-testid="ws-clear"
          >
            記録を削除
          </button>
        )}
      </details>
    </div>
  );
}
