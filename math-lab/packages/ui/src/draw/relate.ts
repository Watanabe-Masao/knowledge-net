// 2つの量の図（stats2-course #577 の D3b）：散布図（偏差の積の長方形・偏差と残差・組ごとの回帰直線）と折れ線（時系列）。
// 数（平均・共分散・回帰直線・平方和・相関係数・幾何平均の率・指数平滑）は図を作るときにデータから求める。
// 形と設定の名前は教材の figures.py の scatter・line と同じ。
import { Canvas, esc, f1, num, type Theme } from "./svg";

const W = 360;

type Axis = { label: string; lo: number; hi: number; step?: number };

export type ScatterSpec = {
  type: "scatter";
  /** cov：偏差の積の長方形、resid：平均からの偏差と直線からの残差、fit：組ごとの回帰直線 */
  show?: "cov" | "resid" | "fit";
  points?: [number, number][];
  /** fit のときの組。adjust を書くと点は (x, z, y) で、縦は y−adjust×z */
  sets?: { label: string; points: number[][]; adjust?: number }[];
  x: Axis;
  y: Axis;
  /** cov：共分散を n−1 で割る */
  unbiased?: boolean;
  /** resid：2乗の和を出す（既定は出す） */
  values?: boolean;
  /** resid：決定係数と相関係数の2乗を並べる */
  r2?: boolean;
  /** fit：傾きだけを出す */
  slope_only?: boolean;
  title?: string;
  note?: string;
};

function stats(pts: [number, number][]) {
  const n = pts.length;
  const mx = pts.reduce((t, p) => t + p[0], 0) / n,
    my = pts.reduce((t, p) => t + p[1], 0) / n;
  let sxy = 0,
    sxx = 0,
    syy = 0;
  for (const [a, b] of pts) {
    sxy += (a - mx) * (b - my);
    sxx += (a - mx) ** 2;
    syy += (b - my) ** 2;
  }
  const b1 = sxy / sxx;
  return { n, mx, my, sxy, sxx, syy, b1, a1: my - b1 * mx, r: sxy / Math.sqrt(sxx * syy) };
}

/** 枠・目盛り・軸の線（教材の scatter と同じ。端の点が枠に重ならないよう内側に余白 P） */
function frame(c: Canvas, sp: ScatterSpec, y0: number) {
  const L = 40,
    R = W - 14,
    T = y0 + 20,
    B = T + 210,
    P = 12;
  const xs = sp.x,
    ys = sp.y;
  const X = (v: number) => L + P + ((v - xs.lo) / (xs.hi - xs.lo)) * (R - L - 2 * P);
  const Y = (v: number) => B - P - ((v - ys.lo) / (ys.hi - ys.lo)) * (B - T - 2 * P);
  for (let t = Math.trunc(ys.lo); t <= Math.trunc(ys.hi); t += ys.step ?? 1) {
    c.line(L, Y(t), R, Y(t), "line", 1);
    c.text(L - 6, Y(t) + 4, num(t), 11, "ink-2", "end");
  }
  for (let t = Math.trunc(xs.lo); t <= Math.trunc(xs.hi); t += xs.step ?? 1)
    c.text(X(t), B + 15, num(t), 11, "ink-2", "middle");
  c.line(L, B, R, B, "ink-2", 1);
  return { L, R, T, B, X, Y };
}

function scatterFit(sp: ScatterSpec, theme: Theme): string {
  const c = new Canvas(theme);
  let y = 8;
  if (sp.title) y = c.para(8, 22, sp.title, 344, 13.5, "ink", "bold") - 8;
  const { L, R, T, B, X, Y } = frame(c, sp, y);
  const cols = ["data-1", "data-hi", "data-2"],
    dashes = [undefined, "6 4", "2 3"];
  const lines: [string, string | undefined, boolean, string][] = [];
  (sp.sets ?? []).forEach((st, k) => {
    const pts: [number, number][] =
      st.adjust !== undefined
        ? st.points.map(([a, z, v]) => [a!, v! - st.adjust! * z!]) // 重回帰で、もう1つの変数の分を除いた見え方
        : st.points.map(([a, b]) => [a!, b!]);
    const s = stats(pts);
    const col = cols[k % 3]!,
      dash = dashes[k % 3];
    c.line(X(sp.x.lo), Y(s.a1 + s.b1 * sp.x.lo), X(sp.x.hi), Y(s.a1 + s.b1 * sp.x.hi), col, 2, dash);
    for (const [a, b] of pts) {
      if (k % 2) c.add(`<rect x="${f1(X(a) - 4)}" y="${f1(Y(b) - 4)}" width="8" height="8"${c.paint({ fill: col })}/>`);
      else c.circle(X(a), Y(b), 4.5, col);
    }
    const ratio = Math.sqrt(s.syy / s.sxx);
    lines.push([
      col,
      dash,
      k % 2 === 1,
      sp.slope_only
        ? `${st.label}：傾き ${num(Number(s.b1.toFixed(2)))}`
        : `${st.label}：相関係数 ${num(Number(s.r.toFixed(2)))}×標準偏差の比 ${num(Number(ratio.toFixed(2)))}＝傾き ${num(s.b1)}`,
    ]);
  });
  y = B + 34;
  c.text(R, y, sp.x.label, 11.5, "ink-2", "end");
  c.text(L, T - 4, sp.y.label, 11.5, "ink-2");
  y += 12;
  for (const [col, dash, sq, t] of lines) {
    // 凡例は線の見本と点の印（丸・四角）の両方
    c.line(10, y + 4, 30, y + 4, col, 2.5, dash);
    if (sq) c.add(`<rect x="36.0" y="${f1(y)}" width="8" height="8"${c.paint({ fill: col })}/>`);
    else c.circle(40, y + 4, 4.5, col);
    y = c.para(50, y + 8, t, 302, 12.5, "ink") + 2;
  }
  if (sp.note) y = c.para(8, y + 4, sp.note, 344, 12.5, "ink-2");
  return c.done(y + 6, `散布図と回帰直線（${(sp.sets ?? []).map((s) => s.label).join("・")}）`);
}

export function drawScatter(sp: ScatterSpec, theme: Theme = "file"): string {
  if (sp.show === "fit") return scatterFit(sp, theme);
  const c = new Canvas(theme);
  const pts = sp.points!;
  const s = stats(pts);
  let y = 8;
  if (sp.title) y = c.para(8, 22, sp.title, 344, 13.5, "ink", "bold") - 8;
  const { L, R, T, B, X, Y } = frame(c, sp, y);
  const mode = sp.show ?? "cov";
  const lines: string[] = [];
  if (mode === "cov") {
    for (const [a, b] of pts) {
      // 偏差の積の長方形：積が正は data-hi、負は data-1（相関ラボと同じ色）
      const pr = (a - s.mx) * (b - s.my);
      if (pr === 0) continue;
      const col = pr > 0 ? "data-hi" : "data-1";
      const [x0, x1] = [X(s.mx), X(a)].sort((p, q) => p - q),
        [y0, y1] = [Y(s.my), Y(b)].sort((p, q) => p - q);
      c.add(
        `<rect x="${f1(x0!)}" y="${f1(y0!)}" width="${f1(x1! - x0!)}" height="${f1(y1! - y0!)}"${c.paint({ fill: col, stroke: col })} fill-opacity="0.18" stroke-width="1"/>`,
      );
    }
    c.line(X(s.mx), T, X(s.mx), B, "ink-2", 1.5, "5 4"); // 平均の点を通る縦・横の線
    c.line(L, Y(s.my), R, Y(s.my), "ink-2", 1.5, "5 4");
    lines.push(
      sp.unbiased
        ? `平均の点（${num(s.mx)}, ${num(s.my)}）・偏差の積の和 ${num(s.sxy)}・共分散（n−1 で割る）${num(s.sxy / (s.n - 1))}`
        : `平均の点（${num(s.mx)}, ${num(s.my)}）・偏差の積の平均（共分散）${num(s.sxy / s.n)}`,
    );
    lines.push("右上・左下の長方形は偏差の積が正（同じ向き）、左上・右下は負（逆の向き）");
  } else {
    c.line(L, Y(s.my), R, Y(s.my), "ink-2", 1.5, "5 4");
    c.line(X(sp.x.lo), Y(s.a1 + s.b1 * sp.x.lo), X(sp.x.hi), Y(s.a1 + s.b1 * sp.x.hi), "data-1", 2);
    let sst = 0,
      sse = 0;
    for (const [a, b] of pts) {
      const f = s.a1 + s.b1 * a;
      sst += (b - s.my) ** 2;
      sse += (b - f) ** 2;
      c.line(X(a) - 4, Y(b), X(a) - 4, Y(s.my), "ink-3", 2, "3 3");
      c.line(X(a) + 4, Y(b), X(a) + 4, Y(f), "data-hi", 2.5);
    }
    if (sp.values ?? true) {
      lines.push(`点線（各点の左）：平均 ${num(s.my)} からの偏差。2乗の和 ${num(sst)}`);
      lines.push(`実線（各点の右）：直線からの残差。2乗の和 ${num(Number(sse.toFixed(4)))}`);
    } else {
      // 概念図で、例題の答えを先に見せない
      lines.push("点線（各点の左）：平均からの偏差。2乗の和が SST");
      lines.push("実線（各点の右）：直線からの残差。2乗の和が SSE");
    }
    if (sp.r2)
      lines.push(
        `R²＝1−SSE÷SST＝${num(Number((1 - sse / sst).toFixed(4)))}、相関係数 r＝${num(Number(s.r.toFixed(4)))} の2乗と同じ`,
      );
  }
  for (const [a, b] of pts) c.circle(X(a), Y(b), 4.5, "ink");
  y = B + 34;
  c.text(R, y, sp.x.label, 11.5, "ink-2", "end");
  c.text(L, T - 4, sp.y.label, 11.5, "ink-2");
  y += 12;
  for (const t of lines) y = c.para(8, y + 8, t, 344, 12.5, "ink") + 2;
  if (sp.note) y = c.para(8, y + 4, sp.note, 344, 12.5, "ink-2");
  return c.done(y + 6, `散布図（${pts.length}点）。相関係数 ${num(Number(s.r.toFixed(2)))}`);
}

export type LineSpec = {
  type: "line";
  series: { label?: string; values: number[]; show_values?: boolean; dash?: string }[];
  labels?: string[];
  /** 最初と最後を同じ倍率で結ぶ線（倍率の幾何平均） */
  geom?: boolean;
  /** 指数平滑の α */
  smooth?: number;
  /** 中央移動平均の窓の幅（奇数）。窓が端からはみ出す時点は描かない */
  ma?: number;
  /** 縦の下端を0にする */
  zero?: boolean;
  title?: string;
  note?: string;
};

export function drawLine(sp: LineSpec, theme: Theme = "file"): string {
  const c = new Canvas(theme);
  const series = sp.series.map((s) => ({ ...s }));
  const first = series[0]!.values;
  const labels = sp.labels ?? first.map((_, i) => String(i + 1));
  const extra: typeof series = [];
  if (sp.geom) {
    const m = first.length - 1,
      g = (first[m]! / first[0]!) ** (1 / m);
    const r = Number(((g - 1) * 100).toFixed(2));
    const rate = (r > 0 ? "＋" : r < 0 ? "−" : "") + num(Math.abs(r));
    extra.push({
      label: `毎期 ${num(Number(g.toFixed(4)))}倍（${rate}%）の線（倍率の幾何平均）`,
      values: Array.from({ length: m + 1 }, (_, i) => first[0]! * g ** i),
      dash: "6 4",
    });
  }
  if (sp.smooth !== undefined) {
    // 指数平滑 S_t＝αx_t＋(1−α)S_{t−1}
    const a = sp.smooth,
      sm = [first[0]!];
    for (const x of first.slice(1)) sm.push(a * x + (1 - a) * sm[sm.length - 1]!);
    extra.push({ label: `指数平滑（α＝${num(a)}）`, values: sm, dash: "6 4" });
  }
  if (sp.ma !== undefined) {
    // 中央移動平均：時点 i を真ん中に、前後 h 個ずつの平均。窓が端からはみ出す時点は NaN（描かない）
    const h = (sp.ma - 1) / 2;
    const mv = first.map((_, i) =>
      i < h || i + h >= first.length ? NaN : first.slice(i - h, i + h + 1).reduce((t, v) => t + v, 0) / sp.ma!,
    );
    extra.push({ label: `中央${sp.ma}点移動平均`, values: mv, dash: "6 4" });
  }
  const all = [...series, ...extra];
  const allv = all.flatMap((s) => s.values).filter(Number.isFinite);
  let lo = Math.min(...allv),
    hi = Math.max(...allv);
  if (sp.zero) lo = 0;
  const pad = (hi - lo) * 0.15 || 1;
  lo -= sp.zero ? 0 : pad;
  hi += pad;
  let y = 8;
  if (sp.title) y = c.para(8, 22, sp.title, 344, 13.5, "ink", "bold") - 8;
  const top = y + 22,
    base = y + 170,
    n = labels.length;
  const X = (i: number) => 30 + (i * (W - 60)) / Math.max(1, n - 1);
  const Y = (v: number) => base - ((v - lo) / (hi - lo)) * (base - top);
  c.line(16, base, W - 16, base, "ink-2", 1);
  const colors = ["data-1", "data-hi", "data-2"];
  // 値の字の位置：ふだんは点の上。同じ時点のほかの線の点が上に近く（18px 以内）にあって字が重なるときだけ、低い方の点の字を下に出す。
  // 下に横軸の名前があって入らないときは上のまま（移動平均の図の 39 と 38。前は低い方を必ず下にして横軸の字に重なった：FIG-U31-error）
  const above = (k: number, i: number) => {
    const v = all[k]!.values[i]!,
      py = Y(v);
    if (py + 19 > base - 6) return true;
    return !all.some((o, j) => {
      const u = o.values[i];
      return j !== k && u !== undefined && Number.isFinite(u) && u > v && py - Y(u) < 18;
    });
  };
  all.forEach((s, k) => {
    const col = colors[k % 3]!;
    const pts = s.values.map((v, i) => [X(i), Y(v), i] as const).filter(([, , i]) => Number.isFinite(s.values[i]));
    c.add(
      `<polyline points="${pts.map(([px, py]) => `${f1(px)},${f1(py)}`).join(" ")}" fill="none"${c.paint({ stroke: col })} stroke-width="2.5"${s.dash ? ` stroke-dasharray="${s.dash}"` : ""} stroke-linejoin="round"/>`,
    );
    pts.forEach(([px, py, i]) => {
      c.circle(px, py, 4, col);
      if (k === 0 || (s.show_values ?? true))
        c.add(
          `<text x="${f1(px)}" y="${f1(above(k, i) ? py - 9 : py + 19)}" font-size="${c.fs(12)}"${c.paint({ fill: "ink", stroke: c.halo })} text-anchor="middle" font-weight="bold" stroke-width="4" paint-order="stroke">${esc(num(Number(s.values[i]!.toFixed(2))))}</text>`,
        );
    });
  });
  // 横軸の名前：長い名前が図の端から出ないよう、端に寄せる（字の幅は半角 0.6 字・全角 1 字で見積もる）
  const em = (t: string) => [...t].reduce((w, ch) => w + (ch.charCodeAt(0) < 0x2000 ? 0.6 : 1), 0) * 11.5;
  labels.forEach((t, i) => {
    const half = em(t) / 2;
    if (X(i) - half < 8) c.text(8, base + 16, t, 11.5, "ink-2", "start");
    else if (X(i) + half > W - 8) c.text(W - 8, base + 16, t, 11.5, "ink-2", "end");
    else c.text(X(i), base + 16, t, 11.5, "ink-2", "middle");
  });
  y = base + 32;
  all.forEach((s, k) => {
    c.line(10, y - 4, 30, y - 4, colors[k % 3]!, 2.5, s.dash);
    y = c.para(36, y, s.label ?? "", 316, 12, "ink-2");
  });
  if (sp.note) y = c.para(8, y + 4, sp.note, 344, 12.5, "ink-2");
  return c.done(y + 6, `折れ線（${labels.join("・")}）`);
}
