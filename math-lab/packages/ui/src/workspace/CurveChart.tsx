// 7 分布の図（パターン3＝連続の分布。stats2-course の issue 608）：密度の曲線と、向き（以下・以上・間・外側）で塗る面積。
// 境目は指で横に引く（触った所から一番近い境目が動く。境目から 22px より遠い所を触っても何も動かさない：画面の原則 1・2）。
// 縦は密度（確率ではない。高さが 1 を超えることもある）。確率は塗った面積で、4 結果の欄に出す。
import { useRef } from "react";
import { contDensity } from "@math-lab/engine";
import { haptic } from "../motion";
import { fmt, minus } from "./shared";
import type { WsCtx } from "./ctx";
import s from "../Workspace.module.css";

export function CurveChart({ w }: { w: WsCtx }) {
  const c = w.curve!;
  const {
    family,
    window: [x0, x1],
    dir,
    bounds,
    active,
    setBound,
    step,
    meanValue,
    prob,
  } = c;
  const W = 340,
    TOP = 18,
    BASE = 124,
    H = BASE + 46,
    L = 10,
    R = 10;
  const X = (v: number) => L + ((Math.min(x1, Math.max(x0, v)) - x0) / (x1 - x0)) * (W - L - R);
  const inv = (px: number) => x0 + ((px - L) / (W - L - R)) * (x1 - x0);
  const N = 240;
  const xs = Array.from({ length: N + 1 }, (_, i) => x0 + ((x1 - x0) * i) / N);
  const ds = xs.map((x) => contDensity(family, x));
  const yMax = Math.max(...ds) * 1.12 || 1;
  const Y = (d: number) => BASE - (d / yMax) * (BASE - TOP);
  // 一様分布は台の端で密度が跳ぶので、端の点を縦に結ぶ（斜めに描かない）
  const pts: [number, number][] =
    family.family === "uniform"
      ? [
          [x0, 0],
          [family.a, 0],
          [family.a, 1 / (family.b - family.a)],
          [family.b, 1 / (family.b - family.a)],
          [family.b, 0],
          [x1, 0],
        ]
      : xs.map((x, i) => [x, ds[i]!]);
  const curve = `M${pts.map(([x, d]) => `${X(x).toFixed(1)},${Y(d).toFixed(1)}`).join("L")}`;
  const area = (a: number, b: number) => {
    const lo = Math.max(a, x0),
      hi = Math.min(b, x1);
    if (!(hi > lo)) return "";
    const k = 120,
      seg = Array.from({ length: k + 1 }, (_, i) => lo + ((hi - lo) * i) / k);
    return `M${X(lo).toFixed(1)},${BASE}${seg.map((x) => `L${X(x).toFixed(1)},${Y(contDensity(family, x)).toFixed(1)}`).join("")}L${X(hi).toFixed(1)},${BASE}Z`;
  };
  const shaded =
    dir === "le"
      ? [area(-Infinity, bounds.hi)]
      : dir === "ge"
        ? [area(bounds.lo, Infinity)]
        : dir === "between"
          ? [area(bounds.lo, bounds.hi)]
          : [area(-Infinity, bounds.lo), area(bounds.hi, Infinity)];
  const svgRef = useRef<SVGSVGElement>(null);
  const grab = useRef<"lo" | "hi" | null>(null);
  const pxOf = (clientX: number) => {
    const r = svgRef.current!.getBoundingClientRect();
    return ((clientX - r.left) / r.width) * W;
  };
  const near = (px: number) => {
    const scale = svgRef.current!.getBoundingClientRect().width / W; // 画面の上の 22px（変形のあと。原則 6）
    const cand = active
      .map((k) => [k, Math.abs(X(bounds[k]) - px) * scale] as const)
      .filter(([, d]) => d <= 22)
      .sort((p, q) => p[1] - q[1]);
    return cand[0]?.[0] ?? null;
  };
  // 目盛り：窓の幅から切りのよい間隔
  const span = x1 - x0;
  const unit = [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10, 20, 25, 50, 100].map(
    (u) => u * 10 ** Math.floor(Math.log10(span / 10)),
  );
  const tick = unit.find((u) => span / u <= 7) ?? span / 5;
  const ticks: number[] = [];
  for (let t = Math.ceil(x0 / tick) * tick; t <= x1 + 1e-9; t += tick) ticks.push(Number(t.toPrecision(10)));
  const name = { lo: c.loSym, hi: c.hiSym };
  return (
    <figure className={s.chart} aria-label="密度の曲線と、塗った面積（確率）">
      <figcaption className={s.chartHead}>
        <b>密度の曲線（面積が確率）</b>
        <span className={s.legend}>
          <span>
            <i className={s.keyArea} />
            塗った面積 {fmt(prob * 100, 2)}%
          </span>
          {meanValue !== undefined && (
            <span>
              <i className={s.keyMean} />
              期待値 {fmt(meanValue, 2)}
            </span>
          )}
        </span>
      </figcaption>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className={s.svg}
        style={{ touchAction: "pan-y" }}
        data-testid="ws-curve"
        onPointerDown={(e) => {
          const k = near(pxOf(e.clientX));
          if (!k) return;
          grab.current = k;
          (e.currentTarget as Element).setPointerCapture(e.pointerId);
          haptic();
        }}
        onPointerMove={(e) => {
          if (grab.current) setBound(grab.current, inv(pxOf(e.clientX)));
        }}
        onPointerUp={() => (grab.current = null)}
        onPointerCancel={() => (grab.current = null)}
      >
        {shaded.map((d, i) => d && <path key={i} d={d} className={s.area} data-testid="ws-area" />)}
        <path d={curve} className={s.curve} data-testid="ws-curve-line" />
        <line x1={L - 6} x2={W - R + 6} y1={BASE} y2={BASE} className={s.base} />
        {meanValue !== undefined && (
          <line x1={X(meanValue)} x2={X(meanValue)} y1={TOP - 6} y2={BASE} className={s.mean} data-testid="ws-mean" />
        )}
        {ticks.map((t) =>
          active.some((k) => Math.abs(X(bounds[k]) - X(t)) < 26) ? null : (
            <text
              key={t}
              x={X(t)}
              y={BASE + 15}
              className={s.xTick}
              textAnchor={X(t) < 16 ? "start" : X(t) > W - 16 ? "end" : "middle"}
            >
              {minus(fmt(t, 4))}
            </text>
          ),
        )}
        {active.map((k) => {
          const x = X(bounds[k]);
          return (
            <g
              key={k}
              role="slider"
              tabIndex={0}
              aria-label={`境目 ${name[k]}`}
              aria-valuenow={bounds[k]}
              aria-valuemin={c.range[k][0]}
              aria-valuemax={c.range[k][1]}
              data-testid={`ws-bound-${k}`}
              data-x={x}
              className={s.boundG}
              onKeyDown={(e) => {
                const d =
                  e.key === "ArrowRight" || e.key === "ArrowUp"
                    ? step
                    : e.key === "ArrowLeft" || e.key === "ArrowDown"
                      ? -step
                      : 0;
                if (!d) return;
                e.preventDefault();
                setBound(k, bounds[k] + d);
              }}
            >
              <line x1={x} x2={x} y1={TOP - 8} y2={BASE + 22} className={s.bound} />
              <rect x={x - 22} y={BASE + 2} width={44} height={44} className={s.hit} />
              <circle cx={x} cy={BASE + 24} r={9} className={s.knob} />
              <text x={Math.min(W - 18, Math.max(18, x))} y={BASE + 43} className={s.xTickOn} textAnchor="middle">
                {name[k]}＝{minus(fmt(bounds[k], 3))}
              </text>
            </g>
          );
        })}
      </svg>
      <p className={s.chartNote}>縦は密度（確率ではない）。境目の丸を横に引くと、塗った面積（確率）が変わる。</p>
    </figure>
  );
}
