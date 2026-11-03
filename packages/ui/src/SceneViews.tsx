// 場面の図のうち、分布の棒（Bars）でないもの（stats2-course #188 04b・#192）。
// 連続の分布の曲線と塗り・2つの 0/1 の量の同時分布の表・z得点の物差し・並びの書き出し・2つの量の長さの比べ。
// 数は場面のモードが engine から出したものを受け取り、ここは描くだけ。
import s from "./Scene.module.css";

export type View =
  | { kind: "density"; from: number; to: number; f: (x: number) => number; shade: [number, number][]; marks?: { x: number; label: string }[]; label: string }
  | { kind: "joint"; p11: number; p10: number; p01: number; p00: number; nameX: string; nameY: string }
  | { kind: "zlines"; groups: { name: string; m: number; s: number; x: number; z: number }[] }
  | { kind: "paths"; n: number; k: number; seqs: boolean[][]; more: number }
  | { kind: "lengths"; rows: { label: string; value: number; text: string; wrong?: boolean }[]; label: string };

const W = 340;
const fx = (v: number) => Number(v.toFixed(1));

/** 連続の分布：曲線と、確率にあたる面積の塗り。横軸の目盛りは端と印の値 */
function Density({ v }: { v: Extract<View, { kind: "density" }> }) {
  const H = 150, B = H - 22, N = 160;
  const xs = Array.from({ length: N + 1 }, (_, i) => v.from + ((v.to - v.from) * i) / N);
  const ys = xs.map(v.f);
  const top = Math.max(1e-9, ...ys) * 1.1;
  const X = (x: number) => ((x - v.from) / (v.to - v.from)) * (W - 8) + 4, Y = (y: number) => B - (y / top) * (B - 8);
  const line = xs.map((x, i) => `${i ? "L" : "M"}${fx(X(x))},${fx(Y(ys[i]!))}`).join("");
  const area = ([a, b]: [number, number]) => {
    const lo = Math.max(v.from, a), hi = Math.min(v.to, b);
    if (!(hi > lo)) return "";
    const pts = Array.from({ length: 61 }, (_, i) => lo + ((hi - lo) * i) / 60);
    return `M${fx(X(lo))},${B}` + pts.map((x) => `L${fx(X(x))},${fx(Y(v.f(x)))}`).join("") + `L${fx(X(hi))},${B}Z`;
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={s.svg} role="img" aria-label={v.label} data-testid="scene-density">
      {v.shade.map((r, i) => <path key={i} d={area(r)} className={s.area} data-testid="scene-area" />)}
      <path d={line} className={s.curve} />
      <line x1={0} x2={W} y1={B} y2={B} className={s.base} />
      {(v.marks ?? []).map((m, i) => (
        <g key={i}>
          <line x1={X(m.x)} x2={X(m.x)} y1={B} y2={B + 4} className={s.base} />
          <text x={Math.min(W - 12, Math.max(12, X(m.x)))} y={B + 16} textAnchor="middle" className={s.tick}>{m.label}</text>
        </g>
      ))}
    </svg>
  );
}

/** 2つの 0/1 の量の同時分布：4つの欄（確率の大きさを面積で）と周辺の確率 */
function Joint({ v }: { v: Extract<View, { kind: "joint" }> }) {
  const cell = (p: number, label: string, id: string) => (
    <div className={s.jcell} data-testid={`joint-${id}`}>
      <span className={s.jfill} style={{ transform: `scale(${Math.sqrt(Math.max(0, p))})` }} aria-hidden="true" />
      <b>{fx(p * 100)}%</b><small>{label}</small>
    </div>
  );
  const px = v.p11 + v.p10, py = v.p11 + v.p01;
  return (
    <div className={s.joint} role="img" aria-label={`${v.nameX}と${v.nameY}の同時分布。両方 ${fx(v.p11 * 100)}%・${v.nameX}だけ ${fx(v.p10 * 100)}%・${v.nameY}だけ ${fx(v.p01 * 100)}%・どちらもしない ${fx(v.p00 * 100)}%`}>
      <span />
      <span className={s.jhead}>{v.nameY}する</span><span className={s.jhead}>しない</span><span className={s.jhead}>計</span>
      <span className={s.jhead}>{v.nameX}する</span>{cell(v.p11, "両方", "11")}{cell(v.p10, `${v.nameX}だけ`, "10")}<span className={s.jsum}>{fx(px * 100)}%</span>
      <span className={s.jhead}>しない</span>{cell(v.p01, `${v.nameY}だけ`, "01")}{cell(v.p00, "どちらも", "00")}<span className={s.jsum}>{fx((1 - px) * 100)}%</span>
      <span className={s.jhead}>計</span><span className={s.jsum}>{fx(py * 100)}%</span><span className={s.jsum}>{fx((1 - py) * 100)}%</span><span />
    </div>
  );
}

/** z得点：集団ごとの物差し（平均を真ん中、±1σ・±2σ の目盛り）に値を置く。同じ z なら同じ位置 */
function ZLines({ v }: { v: Extract<View, { kind: "zlines" }> }) {
  const H = 46 * v.groups.length + 6;
  const X = (z: number) => ((Math.max(-3.5, Math.min(3.5, z)) + 3.5) / 7) * (W - 24) + 12;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={s.svg} role="img" aria-label={v.groups.map((g) => `${g.name}：値 ${g.x}・z＝${fx(g.z * 100) / 100}`).join("。")} data-testid="scene-z">
      {v.groups.map((g, i) => {
        const y = 22 + i * 46;
        return (
          <g key={g.name}>
            <text x={4} y={y - 10} className={s.tickStrong}>{g.name}（平均 {g.m}・σ {g.s}）</text>
            <line x1={X(-3)} x2={X(3)} y1={y} y2={y} className={s.base} />
            {[-2, -1, 0, 1, 2].map((z) => <g key={z}><line x1={X(z)} x2={X(z)} y1={y - 4} y2={y + 4} className={s.base} /><text x={X(z)} y={y + 15} textAnchor="middle" className={s.tick}>{fx(g.m + z * g.s)}</text></g>)}
            <circle cx={X(g.z)} cy={y} r={6} className={i ? s.dot2 : s.dot1} data-testid={`z-dot-${i}`} data-x={X(g.z)} />
          </g>
        );
      })}
    </svg>
  );
}

/** 並びの書き出し：n 回のうち k 回成功する並びを全部（多いときは先頭だけと残りの数） */
function Paths({ v }: { v: Extract<View, { kind: "paths" }> }) {
  return (
    <div className={s.paths} role="img" aria-label={`${v.n} 回のうち ${v.k} 回成功する並び ${v.seqs.length + v.more} 通り`} data-testid="scene-paths">
      {v.seqs.map((q, i) => <span key={i} className={s.seq}>{q.map((x, j) => <i key={j} className={x ? s.win : s.lose}>{x ? "🛒" : "❌"}</i>)}</span>)}
      {v.more > 0 && <span className={s.seqMore}>ほか {v.more} 通り</span>}
    </div>
  );
}

/** 2つの量の長さを比べる（合計の標準偏差：正しい √n 倍と、誤りの n 倍） */
function Lengths({ v }: { v: Extract<View, { kind: "lengths" }> }) {
  const max = Math.max(1e-9, ...v.rows.map((r) => r.value));
  return (
    <div className={s.lengths} role="img" aria-label={v.label}>
      {v.rows.map((r) => (
        <div key={r.label} className={s.lrow}>
          <span>{r.label}</span>
          <span className={s.ltrack}><span className={r.wrong ? s.lbarWrong : s.lbar} style={{ width: `${(r.value / max) * 100}%` }} /></span>
          <b>{r.text}</b>
        </div>
      ))}
    </div>
  );
}

export function SceneView({ view }: { view: View }) {
  switch (view.kind) {
    case "density": return <Density v={view} />;
    case "joint": return <Joint v={view} />;
    case "zlines": return <ZLines v={view} />;
    case "paths": return <Paths v={view} />;
    case "lengths": return <Lengths v={view} />;
  }
}
