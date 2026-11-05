// 7 分布の図：理論＝棒、実験＝点（同じ縦軸）、期待値＝点線、±標準偏差の帯。横は値 v に比例（値の間が不ぞろいでも位置で見せる）。
// 棒への操作はモデルの種類で決まる（パターン1＝押して選ぶ／パターン2＝引いて重みを変える）。Workspace.tsx から分けた（stats2-course #212）
import { useRef } from "react";
import { haptic, useTween } from "../motion";
import { fmt, num6 } from "./shared";
import type { WsCtx } from "./ctx";
import s from "../Workspace.module.css";

export function Chart({ w }: { w: WsCtx }) {
  const {
    st: { values, weights, a, b },
    isTable,
    over,
    set,
    totalW,
    setWeight,
    bars,
    meanValue,
    sdValue,
    transformed,
    table,
    overSym,
    symText,
    exp: { rec, freq, lastDraw },
  } = w;
  const W = 340,
    TOP = 18,
    BASE = 118,
    H = BASE + 26,
    LEFT = 0,
    RIGHT = 34;
  const empMax = rec.values.length ? Math.max(0, ...bars.map((d) => freq.get(d.v) ?? 0)) : 0;
  const rawMax = Math.max(1e-9, ...bars.map((d) => d.y), empMax);
  const tick = [0.01, 0.02, 0.05, 0.1, 0.2, 0.25, 0.5, 1].find((t) => rawMax / t <= 4) ?? 1;
  const yMax = Math.max(tick, Math.ceil(rawMax / tick - 1e-9) * tick);
  const [yMaxT] = useTween([yMax]);
  const ys = useTween(bars.map((d) => d.y));
  const yPos = (v: number) => BASE - (v / yMaxT!) * (BASE - TOP);
  const vs = bars.map((d) => d.v);
  const gap = vs.length > 1 ? Math.min(...vs.slice(1).map((v, i) => v - vs[i]!)) : 1;
  const span = vs.length > 1 ? vs[vs.length - 1]! - vs[0]! + gap : gap;
  const lo = (vs[0] ?? 0) - gap / 2;
  const xPos = (v: number) => LEFT + ((v - lo) / span) * (W - LEFT - RIGHT);
  const bw = (gap / span) * (W - LEFT - RIGHT);
  const barW = Math.max(2, Math.min(bw - Math.max(3, bw * 0.38), 44));
  const every = bars.length <= 13 ? 1 : bars.length <= 31 ? 5 : 10;
  const cur = isTable ? undefined : Number((a * values[over]! + b).toPrecision(12));
  // パターン1：押して横軸の値を選ぶ。パターン2：引いて重みを変える（確率をその高さにする重み）
  const chooseV = (g: (typeof bars)[number]) => {
    if (isTable || g.xs.length !== 1) return;
    haptic();
    set(over, g.xs[0]!);
  };
  const svgRef = useRef<SVGSVGElement>(null);
  const dragTo = (g: (typeof bars)[number], clientY: number, scale: number) => {
    const svg = svgRef.current;
    if (!svg || g.rows.length !== 1) return;
    const r = svg.getBoundingClientRect(),
      y = ((clientY - r.top) / r.height) * H;
    const p = Math.min(0.98, Math.max(0, ((BASE - y) / (BASE - TOP)) * scale));
    const i = g.rows[0]!,
      others = totalW - weights[i]!;
    setWeight(i, others > 0 ? (p * others) / (1 - p) : p > 0 ? 1 : 0);
  };
  const dragScale = useRef<number | null>(null);
  const pct = (v: number) => `${Number((v * 100).toFixed(v < 0.1 ? 1 : 0))}%`;
  const barPath = (x: number, y: number) => {
    const l = x - barW / 2,
      r = Math.min(3, barW / 2, BASE - y);
    return `M${l},${BASE}V${y + r}Q${l},${y} ${l + r},${y}H${l + barW - r}Q${l + barW},${y} ${l + barW},${y + r}V${BASE}Z`;
  };
  const labelOf = (g: (typeof bars)[number]) =>
    isTable && !transformed && g.rows.length === 1 && table!.labels ? table!.labels[g.rows[0]!]! : num6(g.v);
  return (
    <figure className={s.chart} aria-label={`${symText} ごとの確率`}>
      <figcaption className={s.chartHead}>
        <b>{isTable ? `${symText} ごとの確率` : `${overSym?.meaning.split("（")[0] ?? over} ${symText} ごとの確率`}</b>
        <span className={s.legend}>
          <span>
            <i className={s.keyBar} />
            理論
          </span>
          {rec.values.length > 0 && (
            <span>
              <i className={s.keyDot} />
              実験 {rec.values.length} 回
            </span>
          )}
          {meanValue !== undefined && (
            <span>
              <i className={s.keyMean} />
              期待値 {fmt(meanValue, 2)}
            </span>
          )}
          {meanValue !== undefined && sdValue !== undefined && sdValue > 0 && (
            <span>
              <i className={s.keySd} />
              ±標準偏差 {fmt(sdValue, 2)}
            </span>
          )}
        </span>
      </figcaption>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className={s.svg} role="img" data-testid="ws-chart">
        {Array.from({ length: Math.round(yMax / tick) }, (_, i) => (i + 1) * tick).map((t) => (
          <g key={t}>
            <line x1={LEFT} x2={W - RIGHT + 4} y1={yPos(t)} y2={yPos(t)} className={s.grid} />
            <text x={W - 2} y={yPos(t) + 3.5} className={s.yTick} textAnchor="end">
              {pct(t)}
            </text>
          </g>
        ))}
        {meanValue !== undefined &&
          sdValue !== undefined &&
          sdValue > 0 &&
          (() => {
            const x0 = Math.max(LEFT, xPos(meanValue - sdValue)),
              x1 = Math.min(W - RIGHT, xPos(meanValue + sdValue));
            return (
              <rect
                x={x0}
                y={TOP - 6}
                width={Math.max(0, x1 - x0)}
                height={BASE - TOP + 6}
                className={s.sdBand}
                data-testid="ws-sd"
                data-value={sdValue}
                data-x0={x0}
                data-x1={x1}
              />
            );
          })()}
        {bars.map((g, i) => {
          const on = g.v === cur,
            y = yPos(ys[i] ?? 0),
            drag = isTable && g.rows.length === 1;
          return (
            <g
              key={g.v}
              className={s.barG}
              onClick={() => chooseV(g)}
              data-testid={`ws-bar-${num6(g.v)}`}
              aria-label={`${symText}＝${num6(g.v)}：${fmt(g.y)}`}
              onPointerDown={
                drag
                  ? (e) => {
                      dragScale.current = yMaxT!;
                      (e.currentTarget as Element).setPointerCapture(e.pointerId);
                      dragTo(g, e.clientY, dragScale.current);
                    }
                  : undefined
              }
              onPointerMove={
                drag
                  ? (e) => {
                      if ((e.currentTarget as Element).hasPointerCapture(e.pointerId))
                        dragTo(g, e.clientY, dragScale.current ?? yMaxT!);
                    }
                  : undefined
              }
              onPointerUp={
                drag
                  ? () => {
                      dragScale.current = null;
                    }
                  : undefined
              }
            >
              <rect
                x={xPos(g.v) - Math.max(bw, 28) / 2}
                y={0}
                width={Math.max(bw, 28)}
                height={H}
                className={drag ? `${s.hit} ${s.hitDrag}` : s.hit}
              />
              {BASE - y > 0.3 && <path d={barPath(xPos(g.v), y)} className={on ? s.barOn : s.bar} />}
            </g>
          );
        })}
        <line x1={LEFT} x2={W - RIGHT + 4} y1={BASE} y2={BASE} className={s.base} />
        {meanValue !== undefined && (
          <line
            x1={xPos(meanValue)}
            x2={xPos(meanValue)}
            y1={TOP - 6}
            y2={BASE}
            className={s.mean}
            data-testid="ws-mean"
            data-value={meanValue}
            data-x={xPos(meanValue)}
          />
        )}
        {rec.values.length > 0 &&
          bars.map((g) => (
            <circle
              key={g.v === lastDraw ? `e${g.v}-${rec.values.length}` : `e${g.v}`}
              cx={xPos(g.v)}
              cy={yPos(freq.get(g.v) ?? 0)}
              r={g.v === lastDraw ? 4 : 3}
              className={g.v === lastDraw ? `${s.emp} ${s.empJust}` : s.emp}
              data-testid={`ws-emp-${num6(g.v)}`}
              style={
                g.v === lastDraw
                  ? ({ "--drop": `${TOP - 14 - yPos(freq.get(g.v) ?? 0)}px` } as React.CSSProperties)
                  : undefined
              }
            />
          ))}
        {bars
          .map((g, i) => [g, ys[i] ?? 0] as const)
          .filter(([g]) => g.v === cur)
          .map(([g, yv]) => (
            <text
              key={`v${g.v}`}
              x={Math.min(W - RIGHT - 14, Math.max(LEFT + 14, xPos(g.v)))}
              y={Math.min(yPos(yv), rec.values.length ? yPos(freq.get(g.v) ?? 0) : BASE) - 8}
              className={s.valLabel}
              textAnchor="middle"
            >
              {pct(g.y)}
            </text>
          ))}
        {bars.map((g, i) => {
          const on = g.v === cur;
          if (!on && (i % every !== 0 || (cur !== undefined && Math.abs(xPos(g.v) - xPos(cur)) < 16))) return null;
          return (
            <text key={`t${g.v}`} x={xPos(g.v)} y={BASE + 15} className={on ? s.xTickOn : s.xTick} textAnchor="middle">
              {labelOf(g)}
            </text>
          );
        })}
      </svg>
    </figure>
  );
}
