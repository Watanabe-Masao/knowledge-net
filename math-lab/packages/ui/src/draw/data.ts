// データの図（stats2-course #577 の D3a）：ヒストグラム・箱ひげ図・代表値の位置（点を積んで平均・中央値・最頻値に縦線）。
// 数（度数・四分位数・柵・平均）は図を作るときにデータから求める。形と設定の名前は教材の figures.py の hist・boxplot・centers と同じ。
// 四分位数は教材と同じ求め方：小さい順に並べ、半分ずつ（奇数なら中央値を除く）の中央値（figures.py の five）。
import { Canvas, esc, f1, num, type Theme } from "./svg";

const W = 360;

const median = (s: number[]) => {
  const n = s.length;
  return n % 2 ? s[(n - 1) / 2]! : (s[n / 2 - 1]! + s[n / 2]!) / 2;
};

export type Five = {
  min: number;
  max: number;
  q1: number;
  q2: number;
  q3: number;
  iqr: number;
  lo: number;
  hi: number;
  wlo: number;
  whi: number;
  out: number[];
  mean: number;
};

/** 5つの数と柵（Q₁−1.5×IQR・Q₃＋1.5×IQR）。ひげは柵の内の最小・最大まで */
export function five(values: number[]): Five {
  const s = [...values].sort((a, b) => a - b);
  const n = s.length,
    h = Math.floor(n / 2);
  const q1 = median(s.slice(0, h)),
    q2 = median(s),
    q3 = median(s.slice(n - h));
  const iqr = q3 - q1,
    lo = q1 - 1.5 * iqr,
    hi = q3 + 1.5 * iqr;
  const inside = s.filter((x) => x >= lo && x <= hi);
  return {
    min: s[0]!,
    max: s[n - 1]!,
    q1,
    q2,
    q3,
    iqr,
    lo,
    hi,
    wlo: inside[0]!,
    whi: inside[inside.length - 1]!,
    out: s.filter((x) => x < lo || x > hi),
    mean: s.reduce((a, b) => a + b, 0) / n,
  };
}

function box(
  c: Canvas,
  F: Five,
  y: number,
  X: (v: number) => number,
  color: string,
  o: { fence?: boolean; label?: string; mean?: number },
) {
  if (o.label) c.text(8, y - 22, o.label, 12.5, "ink", "start", "bold"); // 柵の点線（y−16から）と箱に重ならない高さ
  if (o.fence) for (const v of [F.lo, F.hi]) c.line(X(v), y - 16, X(v), y + 16, "bad", 1.2, "3 3");
  c.line(X(F.wlo), y, X(F.q1), y, color, 2);
  c.line(X(F.q3), y, X(F.whi), y, color, 2);
  for (const v of [F.wlo, F.whi]) c.line(X(v), y - 7, X(v), y + 7, color, 2);
  const bw = Math.max(1, X(F.q3) - X(F.q1));
  c.rect(X(F.q1), y - 11, bw, 22, color, 3, 0.15);
  c.add(
    `<rect x="${f1(X(F.q1))}" y="${y - 11}" width="${f1(bw)}" height="22" rx="3" fill="none"${c.paint({ stroke: color })} stroke-width="2"/>`,
  );
  c.line(X(F.q2), y - 11, X(F.q2), y + 11, color, 3);
  for (const v of F.out) c.circle(X(v), y, 4.5, "surface", "bad", 2);
  if (o.mean !== undefined) {
    // 平均の位置（▲）。中央値（箱の中の線）との違いを見せる
    const m = X(o.mean);
    c.add(`<path d="M${f1(m)} ${y + 13} l-5 8 h10 z"${c.paint({ fill: "ink" })}/>`);
    c.text(m, y + 32, `平均 ${num(Number(o.mean.toFixed(2)))}`, 11, "ink", "middle");
  }
}

function axis(c: Canvas, lo: number, hi: number, y: number, step: number, X: (v: number) => number) {
  c.line(16, y, W - 16, y, "ink-2", 1);
  for (let t = lo; t <= hi + 1e-9; t += step) c.text(X(t), y + 15, num(t), 11, "ink-2", "middle");
}

export type HistSpec = {
  type: "hist";
  /** データから数える（start から width ごと）か、classes＝[[下限, 上限, 度数], …] */
  data?: number[];
  start?: number;
  width?: number;
  classes?: [number, number, number][];
  /** 幅が違う階級は高さを度数密度（度数÷幅）にする */
  density?: boolean;
  /** 強調する階級の番号（0から） */
  mark?: number;
  /** 下に累積相対度数の行 */
  cumulative?: boolean;
  /** 下に付ける箱ひげ図のデータ */
  box?: number[];
  axis_label?: string;
  title?: string;
  note?: string;
};

export function drawHist(sp: HistSpec, theme: Theme = "file"): string {
  const c = new Canvas(theme);
  let cls: [number, number, number][];
  if (sp.data) {
    const w = sp.width!,
      top = Math.max(...sp.data);
    cls = [];
    for (let a = sp.start!; a <= top; a += w) cls.push([a, a + w, sp.data.filter((x) => a <= x && x < a + w).length]);
  } else cls = sp.classes!;
  const dens = sp.density ?? false;
  const lo = cls[0]![0],
    hi = cls[cls.length - 1]![1];
  const X = (v: number) => 16 + ((v - lo) / (hi - lo)) * (W - 32);
  let y = 8;
  if (sp.title) y = c.para(8, 22, sp.title, 344, 13.5, "ink", "bold") - 8;
  const top = y + 26,
    base = y + 170;
  const hts = cls.map(([a, b, n]) => (dens ? n / (b - a) : n));
  const mx = Math.max(...hts) || 1;
  const total = cls.reduce((t, q) => t + q[2], 0);
  cls.forEach(([a, b, n], i) => {
    const hh = (hts[i]! / mx) * (base - top - 18);
    c.rect(X(a), base - hh, X(b) - X(a) - 1.5, hh, sp.mark === i ? "data-hi" : "data-1", 0, 0.8);
    const lab = dens ? num(Number(hts[i]!.toFixed(3))) : String(n);
    c.add(
      `<text x="${f1((X(a) + X(b)) / 2)}" y="${f1(base - hh - 5)}" font-size="${c.fs(12)}"${c.paint({ fill: "ink", stroke: c.halo })} text-anchor="middle" font-weight="bold" stroke-width="4" paint-order="stroke">${esc(lab)}</text>`,
    );
  });
  const ticks = [...new Set(cls.flatMap(([a, b]) => [a, b]))].sort((a, b) => a - b);
  c.line(16, base, W - 16, base, "ink-2", 1);
  for (const t of ticks) c.text(X(t), base + 15, num(t), 11, "ink-2", "middle");
  y = base + 24;
  if (sp.axis_label) {
    c.text(W - 16, base + 31, sp.axis_label, 11, "ink-2", "end");
    y = base + 46;
  }
  if (dens) {
    y += 8;
    for (const [a, b, n] of cls)
      y = c.para(
        8,
        y + 4,
        `${num(a)}〜${num(b)}：度数${n}÷幅${num(b - a)}＝高さ${num(Number((n / (b - a)).toFixed(3)))}（面積＝${n}）`,
        344,
        12.5,
        "ink",
      );
  } else if (sp.cumulative) {
    y += 8;
    let cum = 0;
    const row = cls.map(([, b, n]) => {
      cum += n;
      return `${num(b)}未満 ${(cum / total).toFixed(2)}`;
    });
    y = c.para(8, y + 4, "累積相対度数：" + row.join("、"), 344, 12.5, "ink");
  }
  if (sp.box) {
    const F = five(sp.box);
    y += 40;
    box(c, F, y, X, "data-hi", { fence: true });
    y += 26;
    y = c.para(
      8,
      y + 10,
      `箱ひげ図：Q₁ ${num(F.q1)}・中央値 ${num(F.q2)}・Q₃ ${num(F.q3)}。柵 ${num(F.lo)}〜${num(F.hi)} の外（○）が外れ値候補`,
      344,
      12,
      "ink-2",
    );
  }
  if (sp.note) y = c.para(8, y + 10, sp.note, 344, 12.5, "ink-2");
  const most = cls.reduce((b, q) => (q[2] > b[2] ? q : b), cls[0]!);
  return c.done(
    y + 6,
    `ヒストグラム（${cls.length}階級・全部で ${total}）。いちばん多いのは ${num(most[0])}〜${num(most[1])}`,
  );
}

export type BoxSpec = {
  type: "boxplot";
  rows: { label?: string; data: number[] }[];
  /** 柵（外れ値の目安）と外れ値候補 */
  fence?: boolean;
  /** 平均の▲ */
  mean?: boolean;
  step?: number;
  lo?: number;
  hi?: number;
  title?: string;
  note?: string;
};

export function drawBoxplot(sp: BoxSpec, theme: Theme = "file"): string {
  const c = new Canvas(theme);
  const Fs = sp.rows.map((r) => five(r.data));
  const step = sp.step ?? 10;
  let lo = sp.lo ?? Math.min(...sp.rows.flatMap((r) => r.data));
  let hi =
    sp.hi ?? Math.max(Math.max(...sp.rows.flatMap((r) => r.data)), sp.fence ? Math.max(...Fs.map((F) => F.hi)) : 0);
  lo = step * Math.floor(lo / step);
  hi = step * Math.ceil(hi / step);
  const X = (v: number) => 16 + ((v - lo) / (hi - lo)) * (W - 32);
  let y = 8;
  if (sp.title) y = c.para(8, 22, sp.title, 344, 13.5, "ink", "bold") - 8;
  y += 38;
  sp.rows.forEach((r, i) => {
    const mean = sp.mean ? Fs[i]!.mean : undefined;
    box(c, Fs[i]!, y, X, "data-1", { fence: sp.fence, label: r.label, mean });
    y += mean !== undefined ? 64 : 52;
  });
  axis(c, lo, hi, y - 22, step, X);
  y += 6;
  sp.rows.forEach((r, i) => {
    const F = Fs[i]!;
    const head = r.label ? `${r.label}：` : "";
    y = c.para(
      8,
      y + 4,
      `${head}Q₁ ${num(F.q1)}・中央値 ${num(F.q2)}・Q₃ ${num(F.q3)}・IQR ${num(F.iqr)}`,
      344,
      12.5,
      "ink",
    );
    if (sp.fence) {
      const out = F.out.map(num).join("・") || "なし";
      y = c.para(
        8,
        y,
        `柵 ${num(F.lo)} と ${num(F.hi)} → 外れ値候補：${out}`,
        344,
        12.5,
        F.out.length ? "bad" : "ink-2",
      );
    }
  });
  if (sp.note) y = c.para(8, y + 4, sp.note, 344, 12.5, "ink-2");
  const F = Fs[0]!;
  return c.done(y + 6, `箱ひげ図。Q₁ ${num(F.q1)}・中央値 ${num(F.q2)}・Q₃ ${num(F.q3)}`);
}

export type CentersSpec = {
  type: "centers";
  data: number[];
  lo?: number;
  hi?: number;
  ticks?: number[];
  /** 中央値・最頻値の線（既定は出す） */
  median?: boolean;
  mode?: boolean;
  axis_label?: string;
  title?: string;
  note?: string;
};

/** 代表値の位置：点を数直線に積み、平均・中央値・最頻値に縦線（名前は下の凡例） */
export function drawCenters(sp: CentersSpec, theme: Theme = "file"): string {
  const c = new Canvas(theme);
  const d = [...sp.data].sort((a, b) => a - b),
    n = d.length;
  const lo = sp.lo ?? d[0]!,
    hi = sp.hi ?? d[n - 1]!;
  const X = (v: number) => 24 + ((v - lo) / (hi - lo)) * (W - 48);
  const mean = d.reduce((a, b) => a + b, 0) / n;
  const med = (d[Math.floor((n - 1) / 2)]! + d[Math.floor(n / 2)]!) / 2;
  const cnt = new Map<number, number>();
  for (const v of d) cnt.set(v, (cnt.get(v) ?? 0) + 1);
  const top = Math.max(...cnt.values());
  const modes = [...cnt].filter(([, k]) => k === top).map(([v]) => v);
  let y = 8;
  if (sp.title) y = c.para(8, 22, sp.title, 344, 13.5, "ink", "bold") - 8;
  const marks: [string, number, string, string | undefined][] = [["平均", mean, "data-1", undefined]];
  if (sp.median ?? true) marks.push(["中央値", med, "data-hi", "6 4"]);
  if (sp.mode ?? true) for (const mv of modes.sort((a, b) => a - b)) marks.push(["最頻値", mv, "data-2", "2 3"]); // 最頻値が2つ以上なら、全部に線を引く
  const base = y + 30 + 12 * top;
  const seen = new Map<number, number>();
  for (const v of d) {
    const k = (seen.get(v) ?? 0) + 1;
    seen.set(v, k);
    c.circle(X(v), base - 8 - (k - 1) * 12, 5, "ink-2");
  }
  for (const [, v, col, dash] of marks) c.line(X(v), y + 14, X(v), base, col, 2.5, dash); // 線は点の上に重ね、名前は下の凡例に置く
  c.line(16, base, W - 16, base, "ink-2", 1);
  for (const t of sp.ticks ?? []) c.text(X(t), base + 15, num(t), 11, "ink-2", "middle");
  y = base + 22;
  for (const [name, v, col, dash] of marks) {
    c.line(10, y + 10, 30, y + 10, col, 2.5, dash);
    c.text(36, y + 14, `${name} ${num(Number(v.toFixed(2)))}`, 12, "ink-2");
    y += 18;
  }
  if (sp.axis_label) y = c.para(8, y + 14, sp.axis_label, 344, 12, "ink-2"); // 凡例の最後の行（y−4 が字の下）に重ならないよう、1行下げる
  if (sp.note) y = c.para(8, y + 4, sp.note, 344, 12.5, "ink-2");
  return c.done(
    y + 6,
    `${n}個の値の点。平均 ${num(Number(mean.toFixed(2)))}・中央値 ${num(med)}・最頻値 ${modes.map(num).join("と")}`,
  );
}

export type DataSpec = HistSpec | BoxSpec | CentersSpec;

/** データの図を描く（type で選ぶ） */
export function drawData(sp: DataSpec, theme: Theme = "file"): string {
  if (sp.type === "hist") return drawHist(sp, theme);
  if (sp.type === "boxplot") return drawBoxplot(sp, theme);
  return drawCenters(sp, theme);
}

export const DATA_TYPES = ["hist", "boxplot", "centers"];
