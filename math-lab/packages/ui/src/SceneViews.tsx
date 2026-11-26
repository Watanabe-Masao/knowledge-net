// 場面の図のうち、分布の棒（Bars）でないもの（stats2-course #188 04b・#192）。
// 連続の分布の曲線と塗り・2つの 0/1 の量の同時分布の表・z得点の物差し・並びの書き出し・2つの量の長さの比べ。
// 数は場面のモードが engine から出したものを受け取り、ここは描くだけ。
import s from "./Scene.module.css";

export type View =
  | {
      kind: "density";
      from: number;
      to: number;
      f: (x: number) => number;
      /** 重ねて比べる曲線（点線。中心極限定理の正規分布など）。縦の物差しは f と同じ */
      g?: (x: number) => number;
      /** g があるときの凡例 [実線の名前, 点線の名前]（原則 7：線の形だけで意味を伝えない） */
      legend?: [string, string];
      /** 縦の上限（F(1, k) のように 0 の近くで密度が限りなく大きくなる分布で、山の形を読めるようにする。超えた所は上で切る） */
      ymax?: number;
      shade: [number, number][];
      marks?: { x: number; label: string }[];
      label: string;
    }
  | {
      kind: "joint";
      p11: number;
      p10: number;
      p01: number;
      p00: number;
      nameX: string;
      nameY: string;
      events?: boolean;
    }
  | { kind: "zlines"; groups: { name: string; m: number; s: number; x: number; z: number }[] }
  | {
      kind: "paths";
      n: number;
      k: number;
      seqs: boolean[][];
      more: number;
      /** 並び1つの確率（札ごとに添える。どれも同じ値） */ each?: string;
    }
  | { kind: "arrange"; role: boolean; groups: { set: string[]; rows: string[][] }[]; more: number; total: number }
  | { kind: "lengths"; rows: { label: string; value: number; text: string; wrong?: boolean }[]; label: string }
  | {
      /** 区間を横の棒で（信頼区間。stats2-course #47 の U22）。曲線は描かない（区間の確率を μ の分布と読ませない） */
      kind: "interval";
      from: number;
      to: number;
      ticks: number[];
      center: number;
      centerLabel: string;
      lo: number;
      hi: number;
      loLabel: string;
      hiLabel: string;
      /** 0 の縦の点線（差の区間が 0 を含むかを読む。stats2-course #47 の U23） */
      zero?: boolean;
      label: string;
    };

const W = 340;
const fx = (v: number) => Number(v.toFixed(1));

/** 連続の分布：曲線と、確率にあたる面積の塗り。横軸の目盛りは端と印の値 */
function Density({ v }: { v: Extract<View, { kind: "density" }> }) {
  const H = 150,
    B = H - 22,
    N = 160;
  const xs = Array.from({ length: N + 1 }, (_, i) => v.from + ((v.to - v.from) * i) / N);
  const ys = xs.map(v.f);
  const gs = v.g ? xs.map(v.g) : [];
  const top = v.ymax ?? Math.max(1e-9, ...ys, ...gs) * 1.1;
  const X = (x: number) => ((x - v.from) / (v.to - v.from)) * (W - 8) + 4,
    Y = (y: number) => B - (Math.min(y, top) / top) * (B - 8);
  const line = xs.map((x, i) => `${i ? "L" : "M"}${fx(X(x))},${fx(Y(ys[i]!))}`).join("");
  const area = ([a, b]: [number, number]) => {
    const lo = Math.max(v.from, a),
      hi = Math.min(v.to, b);
    if (!(hi > lo)) return "";
    const pts = Array.from({ length: 61 }, (_, i) => lo + ((hi - lo) * i) / 60);
    return `M${fx(X(lo))},${B}` + pts.map((x) => `L${fx(X(x))},${fx(Y(v.f(x)))}`).join("") + `L${fx(X(hi))},${B}Z`;
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={s.svg} role="img" aria-label={v.label} data-testid="scene-density">
      {v.shade.map((r, i) => (
        <path key={i} d={area(r)} className={s.area} data-testid="scene-area" />
      ))}
      <path d={line} className={s.curve} />
      {v.g && (
        <path
          d={xs.map((x, i) => `${i ? "L" : "M"}${fx(X(x))},${fx(Y(gs[i]!))}`).join("")}
          className={s.curve2}
          data-testid="scene-curve2"
        />
      )}
      {v.g && v.legend && (
        <g data-testid="scene-legend">
          <line x1={W - 150} x2={W - 134} y1={10} y2={10} className={s.curve} />
          <text x={W - 130} y={14} className={s.legend}>
            {v.legend[0]}
          </text>
          <line x1={W - 150} x2={W - 134} y1={26} y2={26} className={s.curve2} />
          <text x={W - 130} y={30} className={s.legend}>
            {v.legend[1]}
          </text>
        </g>
      )}
      <line x1={0} x2={W} y1={B} y2={B} className={s.base} />
      {(v.marks ?? []).map((m, i) => (
        <g key={i}>
          <line x1={X(m.x)} x2={X(m.x)} y1={B} y2={B + 4} className={s.base} />
          <text x={Math.min(W - 12, Math.max(12, X(m.x)))} y={B + 16} textAnchor="middle" className={s.tick}>
            {m.label}
          </text>
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
      <b>{fx(p * 100)}%</b>
      <small>{label}</small>
    </div>
  );
  const px = v.p11 + v.p10,
    py = v.p11 + v.p01;
  // 事象として見るときは「起きる・起きない」（量の「する・しない」と言い分ける）
  const [yes, no] = v.events ? ["が起きる", "起きない"] : ["する", "しない"];
  return (
    <div
      className={s.joint}
      role="img"
      aria-label={`${v.nameX}と${v.nameY}の同時分布。両方 ${fx(v.p11 * 100)}%・${v.nameX}だけ ${fx(v.p10 * 100)}%・${v.nameY}だけ ${fx(v.p01 * 100)}%・どちらもしない ${fx(v.p00 * 100)}%`}
    >
      <span />
      <span className={s.jhead}>
        {v.nameY}
        {yes}
      </span>
      <span className={s.jhead}>{no}</span>
      <span className={s.jhead}>計</span>
      <span className={s.jhead}>
        {v.nameX}
        {yes}
      </span>
      {cell(v.p11, "両方", "11")}
      {cell(v.p10, `${v.nameX}だけ`, "10")}
      <span className={s.jsum}>{fx(px * 100)}%</span>
      <span className={s.jhead}>{no}</span>
      {cell(v.p01, `${v.nameY}だけ`, "01")}
      {cell(v.p00, "どちらも", "00")}
      <span className={s.jsum}>{fx((1 - px) * 100)}%</span>
      <span className={s.jhead}>計</span>
      <span className={s.jsum}>{fx(py * 100)}%</span>
      <span className={s.jsum}>{fx((1 - py) * 100)}%</span>
      <span />
    </div>
  );
}

/** z得点：集団ごとの物差し（平均を真ん中、±1σ・±2σ の目盛り）に値を置く。同じ z なら同じ位置 */
function ZLines({ v }: { v: Extract<View, { kind: "zlines" }> }) {
  const H = 46 * v.groups.length + 6;
  const X = (z: number) => ((Math.max(-3.5, Math.min(3.5, z)) + 3.5) / 7) * (W - 24) + 12;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={s.svg}
      role="img"
      aria-label={v.groups.map((g) => `${g.name}：値 ${g.x}・z＝${fx(g.z * 100) / 100}`).join("。")}
      data-testid="scene-z"
    >
      {v.groups.map((g, i) => {
        const y = 22 + i * 46;
        return (
          <g key={g.name}>
            <text x={4} y={y - 10} className={s.tickStrong}>
              {g.name}（平均 {g.m}・σ {g.s}）
            </text>
            <line x1={X(-3)} x2={X(3)} y1={y} y2={y} className={s.base} />
            {[-2, -1, 0, 1, 2].map((z) => (
              <g key={z}>
                <line x1={X(z)} x2={X(z)} y1={y - 4} y2={y + 4} className={s.base} />
                <text x={X(z)} y={y + 15} textAnchor="middle" className={s.tick}>
                  {fx(g.m + z * g.s)}
                </text>
              </g>
            ))}
            <circle
              cx={X(g.z)}
              cy={y}
              r={6}
              className={i ? s.dot2 : s.dot1}
              data-testid={`z-dot-${i}`}
              data-x={X(g.z)}
            />
          </g>
        );
      })}
    </svg>
  );
}

/** 並びの書き出し：n 回のうち k 回成功する並びを全部（多いときは先頭だけと残りの数）。
 *  成功は塗った丸・失敗は白抜きの丸（絵文字にしない。画面の原則 7・18）。札ごとに並び1つの確率を添え、どの並びも同じ確率だと目で見せる */
function Paths({ v }: { v: Extract<View, { kind: "paths" }> }) {
  return (
    <div data-testid="scene-paths">
      <p className={s.seqKey} aria-hidden="true">
        <i className={s.win} /> 成功 <i className={s.lose} /> 失敗
      </p>
      <div
        className={s.pathGrid}
        role="img"
        aria-label={`${v.n} 回のうち ${v.k} 回成功する並び ${v.seqs.length + v.more} 通り${v.each ? `。どの並びも確率 ${v.each}` : ""}`}
      >
        {v.seqs.map((q, i) => (
          <span key={i} className={s.seq}>
            <span className={s.marks}>
              {q.map((x, j) => (
                <i key={j} className={x ? s.win : s.lose} />
              ))}
            </span>
            {v.each && <small>{v.each}</small>}
          </span>
        ))}
        {v.more > 0 && <span className={s.seqMore}>ほか {v.more} 通り</span>}
      </div>
    </div>
  );
}

/** 並べて数える：組（色の帯1本）ごとに、役割ありならその中の並べ方を並べ、なしなら組を1つの札にする */
function Arrange({ v }: { v: Extract<View, { kind: "arrange" }> }) {
  const label = `${v.role ? "役割を区別して" : "役割を区別せず"} ${v.total} 通り`;
  if (!v.groups.length)
    return (
      <p className={s.seqMore} role="img" aria-label={label} data-testid="scene-arrange">
        数が多いので書き出さない（{v.total} 通り）
      </p>
    );
  return (
    <div className={s.paths} role="img" aria-label={label} data-testid="scene-arrange">
      {v.groups.map((g) => (
        <span key={g.set.join("")} className={`${s.seq} ${s.group}`} data-testid="scene-arrange-group">
          {v.role ? g.rows.map((row) => <i key={row.join("")}>{row.join("→")}</i>) : <i>{`{${g.set.join(",")}}`}</i>}
        </span>
      ))}
      {v.more > 0 && <span className={s.seqMore}>ほか {v.more} 組</span>}
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
          <span className={s.ltrack}>
            <span className={r.wrong ? s.lbarWrong : s.lbar} style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <b>{r.text}</b>
        </div>
      ))}
    </div>
  );
}

function Interval({ v }: { v: Extract<View, { kind: "interval" }> }) {
  const H = 92;
  const X = (x: number) => ((Math.max(v.from, Math.min(v.to, x)) - v.from) / (v.to - v.from)) * (W - 24) + 12;
  const y = 46;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={s.svg} role="img" aria-label={v.label} data-testid="scene-interval">
      <line x1={X(v.from)} x2={X(v.to)} y1={y + 22} y2={y + 22} className={s.base} />
      {v.ticks.map((t) => (
        <g key={t}>
          <line x1={X(t)} x2={X(t)} y1={y + 18} y2={y + 26} className={s.base} />
          <text x={X(t)} y={y + 40} textAnchor="middle" className={s.tickStrong}>
            {fx(t)}
          </text>
        </g>
      ))}
      {v.zero && v.from < 0 && v.to > 0 ? (
        <line x1={X(0)} x2={X(0)} y1={y - 14} y2={y + 26} className={s.zero} data-testid="interval-zero" />
      ) : null}
      <line x1={X(v.lo)} x2={X(v.hi)} y1={y} y2={y} className={s.ibar} data-testid="interval-bar" />
      <circle cx={X(v.center)} cy={y} r={6} className={s.dot1} />
      <text x={X(v.center)} y={y - 12} textAnchor="middle" className={s.tickStrong}>
        {v.centerLabel}
      </text>
      <text x={X(v.lo)} y={y - 12} textAnchor="start" className={s.tickStrong}>
        {v.loLabel}
      </text>
      <text x={X(v.hi)} y={y - 12} textAnchor="end" className={s.tickStrong}>
        {v.hiLabel}
      </text>
    </svg>
  );
}

export function SceneView({ view }: { view: View }) {
  switch (view.kind) {
    case "density":
      return <Density v={view} />;
    case "joint":
      return <Joint v={view} />;
    case "zlines":
      return <ZLines v={view} />;
    case "paths":
      return <Paths v={view} />;
    case "arrange":
      return <Arrange v={view} />;
    case "lengths":
      return <Lengths v={view} />;
    case "interval":
      return <Interval v={view} />;
  }
}
