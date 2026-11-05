// 4 結果と 5 計算過程：パターン1は値を入れた式から1段ずつ、パターン2は Σ を1項ずつ（どちらも最後が結果の値）。Workspace.tsx から分けた（stats2-course #212）
import { substitute, toTex } from "@math-lab/engine";
import { Tween } from "./Tween";
import { fmt, render, short } from "./shared";
import type { WsCtx } from "./ctx";
import s from "../Workspace.module.css";

export function CalcPanel({ w }: { w: WsCtx }) {
  const {
    st: { values },
    patch,
    lhs,
    isTable,
    over,
    symbols,
    result,
    isProb,
    steps,
    shownStep,
    display,
  } = w;
  const setStep = (step: number) => patch({ step });
  return (
    <>
      <div className={s.result} data-testid="ws-result">
        <span
          className={s.resultLhs}
          data-testid="ws-result-lhs"
          dangerouslySetInnerHTML={{
            __html: lhs
              ? render(
                  toTex(isTable ? lhs : substitute(lhs, { values: { [over]: values[over]! } }), { symbols }),
                  false,
                )
              : "",
          }}
        />
        <Tween
          className={s.resultVal}
          data-testid="ws-result-val"
          data-value={result}
          v={result}
          show={(x) => (isProb && x !== undefined ? `${(x * 100).toFixed(2)}%` : fmt(x))}
        />
        {isProb && <small className={s.resultSub}>{fmt(result, 5)}</small>}
      </div>
      {steps.length > 1 && (
        <div className={s.calc} data-testid="ws-calc">
          <div className={s.calcHead}>
            <span className={s.muted}>計算の段</span>
            <button
              type="button"
              className={s.step}
              onClick={() => setStep(Math.max(1, shownStep - 1))}
              disabled={shownStep <= 1}
              aria-label="前の段"
            >
              ‹
            </button>
            <span className={s.stepNo}>
              {shownStep}／{steps.length - 1}
            </span>
            <button
              type="button"
              className={s.step}
              onClick={() => setStep(Math.min(steps.length - 1, shownStep + 1))}
              disabled={shownStep >= steps.length - 1}
              aria-label="次の段"
            >
              ›
            </button>
          </div>
          <div
            className={s.calcTex}
            data-testid="ws-calc-tex"
            dangerouslySetInnerHTML={{
              __html: render(
                `${toTex(display(steps[shownStep]!), { symbols, num: short })}${shownStep < steps.length - 1 ? `=${toTex(display(steps[steps.length - 1]!), { symbols, num: short })}` : ""}`,
                false,
              ),
            }}
          />
        </div>
      )}
    </>
  );
}
