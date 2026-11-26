// 4 結果と 5 計算過程：パターン1は値を入れた式から1段ずつ、パターン2は Σ を1項ずつ（どちらも最後が結果の値）。Workspace.tsx から分けた（stats2-course #212）
import { substitute, toTex } from "@math-lab/engine";
import { Tween } from "./Tween";
import { fmt, render, short } from "./shared";
import type { WsCtx } from "./ctx";
import s from "../Workspace.module.css";

// とても小さい確率は 0.00% に丸めない（壊れて見える。計算の段の指数の形とそろえる。照らしの「0.1% 未満」と同じ考え。stats2-course の issue 507）
const tiny = (x: number | undefined) => x !== undefined && x > 0 && x * 100 < 0.005;
const pct = (x: number) => (tiny(x) ? "0.01% 未満" : `${(x * 100).toFixed(2)}%`);

export function CalcPanel({ w }: { w: WsCtx }) {
  const {
    st: { values },
    patch,
    lhs,
    isTable,
    over,
    symbols,
    result,
    zeros,
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
          show={(x) => (isProb && x !== undefined ? pct(x) : fmt(x))}
        />
        {isProb && <small className={s.resultSub}>{tiny(result) ? short(result!) : fmt(result, 5)}</small>}
      </div>
      {zeros.length > 0 && (
        <p className={s.zeroWhy} data-testid="ws-zero-why">
          0 になる：
          {zeros.map((z, i) => (
            <span key={i}>
              {i > 0 && "。"}
              <span dangerouslySetInnerHTML={{ __html: render(toTex(z.node, { symbols }), false) }} />
              {z.k < 0
                ? ` は選ぶ数が ${z.k}（負）で、0 通り`
                : ` は ${z.n} 個から ${z.k} 個を${z.name === "comb" ? "選ぶ" : "並べる"}数。${z.n} 個しかないので 0 通り`}
            </span>
          ))}
        </p>
      )}
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
