// 9 実験：理論の分布（変換後の値）から1回ずつ引き、同じ図に積み上げる。Workspace.tsx から分けた（stats2-course #212）
import { fmt, num6 } from "./shared";
import type { WsCtx } from "./ctx";
import s from "../Workspace.module.css";

export function ExpPanel({ w }: { w: WsCtx }) {
  const {
    symText,
    meanValue,
    exp: { seed, rec, lastDraw, run, clearRec },
  } = w;
  return (
    <>
      {
        <div className={s.exp} data-testid="ws-exp">
          <div className={s.expRow}>
            <b>実験する</b>
            <div className={s.expBtns} role="group" aria-label="実験の回数">
              <button type="button" className={s.expBtn} onClick={() => run(1)} data-testid="ws-run-1">
                1回
              </button>
              <button type="button" className={s.expBtn} onClick={() => run(100)} data-testid="ws-run-100">
                100回
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
          <div className={s.expFoot}>
            <span>種 {seed}</span>
            <button type="button" className={s.clear} onClick={clearRec} disabled={!rec.values.length}>
              記録を削除
            </button>
          </div>
        </div>
      }
    </>
  );
}
