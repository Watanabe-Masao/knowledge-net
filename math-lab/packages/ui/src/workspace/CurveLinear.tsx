// 8 変換（パターン3＝連続の分布のうち正規分布。stats2-course の issue 608。渡辺さん 2026-11-28）：Y＝aX＋b も正規分布 N(aμ＋b, (|a|σ)²) のまま。
// 境目も y＝ax＋b に移るので、塗った面積（確率）は変わらない。「標準化する」は a＝1/σ・b＝−μ/σ の特別な場合で、標準正規分布の物差しになる。
import { haptic } from "../motion";
import { fmt, minus } from "./shared";
import type { WsCtx } from "./ctx";
import s from "../Workspace.module.css";

export function CurveLinear({ w }: { w: WsCtx }) {
  const c = w.curve!;
  const {
    st: { a, b },
    patch,
  } = w;
  const mu = c.meanValue ?? 0,
    sd = c.sd;
  // b の範囲は、標準化の −μ/σ が入る広さ（μ＝500・σ＝4 なら −125 を含む）
  const B = Math.max(10, Math.ceil((2 * Math.abs(mu)) / sd / 10) * 10);
  const sa = Number((1 / sd).toPrecision(6)),
    sb = Number((-mu / sd).toPrecision(6));
  const std = a === sa && b === sb;
  const n = (x: number) => minus(fmt(x, 4));
  const sliders = [
    ["a", a, (x: number) => patch({ a: x }), -3, 3, 0.05, "掛ける定数"],
    ["b", b, (x: number) => patch({ b: x }), -B, B, B > 50 ? 1 : 0.5, "足す定数"],
  ] as const;
  return (
    <fieldset className={s.linear} data-testid="ws-linear">
      <legend>全部の値を a 倍して b 足す（Y＝aX＋b）</legend>
      {sliders.map(([k, v, setV, mn, mx, st, name]) => (
        <label key={k} className={s.slider}>
          <span className={s.sliderSym}>{k}</span>
          <span className={s.sliderName}>{name}</span>
          <b className={s.sliderVal}>{n(v)}</b>
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
            style={{ "--fill": `${((Math.min(mx, Math.max(mn, v)) - mn) / (mx - mn)) * 100}%` } as React.CSSProperties}
            aria-label={`${k}（${name}）`}
            data-testid={`ws-${k}`}
          />
        </label>
      ))}
      <div className={s.expBtns}>
        <button
          type="button"
          className={s.expBtn}
          aria-pressed={std}
          onClick={() => {
            haptic();
            patch({ a: sa, b: sb });
          }}
          data-testid="ws-standardize"
        >
          標準化する（a＝1/σ、b＝−μ/σ）
        </button>
        <button
          type="button"
          className={s.expBtn}
          disabled={a === 1 && b === 0}
          onClick={() => {
            haptic();
            patch({ a: 1, b: 0 });
          }}
          data-testid="ws-untransform"
        >
          元に戻す
        </button>
      </div>
      <p className={s.linearOut} data-testid="ws-linear-result">
        {a === 0 ? (
          <>a＝0 では Y はいつも {n(b)} の1点になり、密度の曲線は描けない。</>
        ) : a === 1 && b === 0 ? (
          <>a・b を動かすか「標準化する」を押すと、図が Y の分布に替わる。</>
        ) : (
          <>
            Y は正規分布 N({n(a * mu + b)}, {n(Math.abs(a) * sd)}²)。境目も y＝ax＋b に移るので、塗った面積は{" "}
            <b>{fmt(c.prob * 100, 2)}%</b> のまま。
            {std && <> 標準化した Z＝(X−μ)/σ は標準正規分布 N(0, 1) に従う。</>}
          </>
        )}
      </p>
    </fieldset>
  );
}
