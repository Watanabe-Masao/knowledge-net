// 8 変換：全部の値を a 倍して b 足す（概念に E(aX＋b) の式があるとき）。Workspace.tsx から分けた（stats2-course #212）
import { toTex } from "@math-lab/engine";
import { haptic } from "../motion";
import { fmt, minus, paren, render, signed } from "./shared";
import type { WsCtx } from "./ctx";
import s from "../Workspace.module.css";

export function Linear({ w }: { w: WsCtx }) {
  const {
    st: { a, b },
    patch,
    linear,
    meanX,
    meanValue,
  } = w;
  return (
    <>
      {linear && (
        <fieldset className={s.linear} data-testid="ws-linear">
          <legend>期待値の性質を試す：全部の値を a 倍して b 足す（Y＝aX＋b）</legend>
          {(
            [
              ["a", a, (v: number) => patch({ a: v }), -3, 3, 0.5, "掛ける定数"],
              ["b", b, (v: number) => patch({ b: v }), -10, 10, 1, "足す定数"],
            ] as const
          ).map(([k, v, setV, mn, mx, st, name]) => (
            <label key={k} className={s.slider}>
              <span className={s.sliderSym}>{k}</span>
              <span className={s.sliderName}>{name}</span>
              <b className={s.sliderVal}>{v}</b>
              <input
                type="range"
                min={mn}
                max={mx}
                step={st}
                value={v}
                onChange={(e) => {
                  haptic();
                  setV(Number(e.target.value));
                }}
                style={{ "--fill": `${((v - mn) / (mx - mn)) * 100}%` } as React.CSSProperties}
                aria-label={`${k}（${name}）`}
                data-testid={`ws-${k}`}
              />
            </label>
          ))}
          {linear.tree && (
            <div
              className={s.calcTex}
              dangerouslySetInnerHTML={{ __html: render(toTex(linear.tree, { symbols: linear.symbols }), false) }}
            />
          )}
          <p className={s.linearOut}>
            {meanX === undefined ? (
              "—"
            ) : (
              <>
                E(aX＋b)＝{signed(a, false)}×{paren(meanX)}
                {signed(b, true)}＝<b data-testid="ws-linear-result">{minus(fmt(meanValue, 4))}</b>
              </>
            )}
          </p>
          {a === 0 && <p className={s.hint}>すべての値が {b} になり、確率は1つの値にまとまる。</p>}
        </fieldset>
      )}
    </>
  );
}
