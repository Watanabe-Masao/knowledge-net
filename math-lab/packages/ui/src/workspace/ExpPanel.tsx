// 9 実験：理論の分布（変換後の値）から1回ずつ引き、同じ図に積み上げる。Workspace.tsx から分けた（stats2-course #212）
import { useState } from "react";
import { fmt, num6 } from "./shared";
import type { WsCtx } from "./ctx";
import s from "../Workspace.module.css";

export function ExpPanel({ w }: { w: WsCtx }) {
  const {
    symText,
    meanValue,
    exp: { seed, rec, lastDraw, run, clearRec },
  } = w;
  const [asking, setAsking] = useState(false); // 記録を消す前に一度たずねる（UI レビュー「操作と入力」）
  return (
    <>
      {
        <div className={s.exp} data-testid="ws-exp">
          <div className={s.expRow}>
            <b>実験する</b>
            {/* 押すとすぐ実験が走る2つのボタン（回数を選ぶ切り替えに見えないよう、つなげず同じ形に。UI レビュー「操作と入力」） */}
            <div className={s.expBtns}>
              <button type="button" className={s.expBtn} onClick={() => run(1)} data-testid="ws-run-1">
                1回引く
              </button>
              <button type="button" className={s.expBtn} onClick={() => run(100)} data-testid="ws-run-100">
                100回引く
              </button>
            </div>
          </div>
          <p className={s.expStat} data-testid="ws-exp-stat" aria-live="polite">
            {rec.values.length ? (
              <>
                実験 <b>{rec.values.length}</b> 回
                {lastDraw !== null && (
                  <>
                    （今回 {symText}＝<b>{num6(lastDraw)}</b>）
                  </>
                )}
                ・平均 <b>{fmt(rec.mean, 2)}</b>
                {meanValue !== undefined && <>（理論 {fmt(meanValue, 2)}）</>}
              </>
            ) : (
              <>まだ実験していない。回数を増やすと、点が棒の高さに近づくかを見る。</>
            )}
          </p>
          {/* 種と記録の削除は、ふだんは閉じた「記録」の中に（種は同じ結果を作り直すための番号）。削除は一度たずねる */}
          <details className={s.expFoot} data-testid="ws-exp-more">
            <summary>記録</summary>
            <p className={s.expSeed}>乱数の種 {seed}（同じ種なら同じ結果になる）</p>
            {asking ? (
              <div className={s.expAsk} role="group" aria-label="記録を消す">
                <span>{rec.values.length} 回の記録を消す？</span>
                <button
                  type="button"
                  className={s.clear}
                  onClick={() => {
                    clearRec();
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
                disabled={!rec.values.length}
                data-testid="ws-clear"
              >
                記録を削除
              </button>
            )}
          </details>
        </div>
      }
    </>
  );
}
