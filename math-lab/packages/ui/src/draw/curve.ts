// 連続の分布の曲線（静止図の型 dist のうち、連続の分布。stats2-course #577 の D2）。
// 密度は engine で求める（t・カイ二乗・F は engine の dists。正規は normalDensity）。形は教材の figures.py の dist（連続）と同じ：
// 曲線・塗る範囲（shade：from〜to か、outside の両裾）・縦の点線と名前（marks）・重ねる正規分布の点線・平均の▲・凡例・注。
// 設定の名前は figures.py の dist と同じ（正規 mu・sigma、一様 a・b、指数 lam、t・chi2 df、F d1・d2、横軸 ticks＝[左, 右, 刻み]）
import { chi2Density, fDensity, normalDensity, tDensity } from "@math-lab/engine";
import { Canvas, esc, f1, num, type Theme } from "./svg";

export type CurveFamily =
  | { family: "normal"; mu: number; sigma: number }
  | { family: "uniform"; a: number; b: number }
  | { family: "expo"; lam: number }
  | { family: "t"; df: number }
  | { family: "chi2"; df: number }
  | { family: "f"; d1: number; d2: number };

export type Shade = { from: number; to: number; label?: string } | { outside: [number, number]; label?: string };

export type CurveSpec = CurveFamily & {
  /** 横軸：[左, 右, 目盛りの刻み] */
  ticks: [number, number, number];
  shade?: Shade[];
  marks?: { x: number; label: string }[];
  /** 同じ縦の物差しで重ねる正規分布（点線） */
  overlay?: { family: "normal"; mu: number; sigma: number; label?: string };
  mark_mean?: boolean;
  unit?: string;
  title?: string;
  label?: string;
  lines?: string[];
  note?: string;
};

export const CURVE_FAMILIES = ["normal", "uniform", "expo", "t", "chi2", "f"];

/** 密度の関数と平均（平均がない分布は NaN） */
export function densityOf(sp: CurveFamily): { f: (x: number) => number; mean: number; name: string; short: string } {
  switch (sp.family) {
    case "normal":
      return {
        f: (x) => normalDensity(x, sp.mu, sp.sigma),
        mean: sp.mu,
        name: `正規分布 N(${num(sp.mu)}, ${num(sp.sigma)}²)`,
        short: `N(${num(sp.mu)}, ${num(sp.sigma)}²)`,
      };
    case "uniform":
      return {
        f: (x) => (x >= sp.a && x <= sp.b ? 1 / (sp.b - sp.a) : 0),
        mean: (sp.a + sp.b) / 2,
        name: `一様分布（${num(sp.a)}〜${num(sp.b)}）`,
        short: `一様 ${num(sp.a)}〜${num(sp.b)}`,
      };
    case "expo":
      return {
        f: (x) => (x >= 0 ? sp.lam * Math.exp(-sp.lam * x) : 0),
        mean: 1 / sp.lam,
        name: `指数分布（λ＝${num(sp.lam)}）`,
        short: `指数 λ＝${num(sp.lam)}`,
      };
    case "t":
      return {
        f: (x) => tDensity(x, sp.df),
        mean: sp.df > 1 ? 0 : NaN,
        name: `t 分布 t(${sp.df})`,
        short: `t(${sp.df})`,
      };
    case "chi2": {
      // x＝0 は右からの極限（自由度2で 1/2）。自由度が2未満は 0 で限りなく大きいので、F と同じく x＝0.5 の 2.5 倍で切る
      const g = (x: number) => chi2Density(x === 0 ? 1e-12 : x, sp.df);
      const cap = sp.df < 2 ? 2.5 * g(0.5) : Infinity;
      return { f: (x) => Math.min(g(x), cap), mean: sp.df, name: `カイ二乗分布 χ²(${sp.df})`, short: `χ²(${sp.df})` };
    }
    case "f": {
      const g = (x: number) => fDensity(x === 0 ? 1e-12 : x, sp.d1, sp.d2); // x＝0 は右からの極限
      // 分子の自由度が2以下では 0 の近くで限りなく大きい（1）か最大（2）なので、図の縦は x＝0.5 の密度の 2.5 倍で切る（figures.py と同じ）
      const cap = sp.d1 <= 2 ? 2.5 * g(0.5) : Infinity;
      return {
        f: (x) => Math.min(g(x), cap),
        mean: sp.d2 > 2 ? sp.d2 / (sp.d2 - 2) : NaN,
        name: `F 分布 F(${sp.d1}, ${sp.d2})`,
        short: `F(${sp.d1}, ${sp.d2})`,
      };
    }
  }
}

export function drawCurve(sp: CurveSpec, theme: Theme = "file"): string {
  const c = new Canvas(theme);
  const unit = sp.unit ?? "";
  let y = 8;
  if (sp.title) y = c.para(8, 22, sp.title, 344, 13.5, "ink", "bold") - 8;
  const top = y + 26,
    base = y + 190,
    left = 20,
    right = 340;
  const { f, mean, name, short } = densityOf(sp);
  const [lo, hi, step] = sp.ticks;
  const X = (v: number) => left + ((v - lo) / (hi - lo)) * (right - left);
  const xs = Array.from({ length: 241 }, (_, i) => lo + ((hi - lo) * i) / 240);
  const g = sp.overlay ? (x: number) => normalDensity(x, sp.overlay!.mu, sp.overlay!.sigma) : null;
  const pmax = Math.max(...xs.map(f).filter(Number.isFinite), ...(g ? xs.map(g) : []));
  const scale = (base - top - 18) / pmax;
  const Y = (v: number) => base - (Number.isFinite(v) ? v : pmax) * scale;
  c.line(left, base, right, base, "ink-2", 1);
  for (const sh of sp.shade ?? []) {
    const outside = "outside" in sh;
    const parts: [number, number][] = outside
      ? [
          [lo, sh.outside[0]],
          [sh.outside[1], hi],
        ]
      : [[sh.from, sh.to]];
    for (const [a0, b0] of parts) {
      const a = Math.max(a0, lo),
        b = Math.min(b0, hi); // 裾だけを拡大した図では、範囲の外の部分を描かない
      if (b <= a) continue;
      const pts = Array.from({ length: 81 }, (_, i) => a + ((b - a) * i) / 80);
      const d =
        `M${f1(X(a))},${base} ` + pts.map((x) => `L${f1(X(x))},${f1(Y(f(x)))}`).join(" ") + ` L${f1(X(b))},${base} Z`;
      c.add(
        `<path d="${d}"${c.paint({ fill: outside ? "data-hi" : "data-1" })} fill-opacity="${outside ? 0.55 : 0.35}"/>`,
      );
    }
    if (sh.label) {
      if (outside) c.text(right, base - 62, sh.label, 11.5, "data-hi", "end", "bold");
      else {
        const mid = (sh.from + sh.to) / 2;
        c.add(
          `<text x="${f1(X(mid))}" y="${f1(base - f(mid) * scale * 0.45)}" font-size="${c.fs(12.5)}"${c.paint({ fill: "ink", stroke: c.halo })} text-anchor="middle" font-weight="bold" stroke-width="4" paint-order="stroke">${esc(sh.label)}</text>`,
        );
      }
    }
  }
  c.add(
    `<path d="M${xs.map((x) => `${f1(X(x))},${f1(Y(f(x)))}`).join(" L")}" fill="none"${c.paint({ stroke: "data-1" })} stroke-width="2.2"/>`,
  );
  (sp.marks ?? []).forEach((mk, i) => {
    c.line(X(mk.x), top - 4 + i * 16, X(mk.x), base, "ink-2", 1.2, "4 3");
    c.text(X(mk.x) + 4, top + 6 + i * 16, mk.label, 11.5, "ink-2");
  });
  if (g)
    c.add(
      `<path d="M${xs.map((x) => `${f1(X(x))},${f1(Y(g(x)))}`).join(" L")}" fill="none"${c.paint({ stroke: "ink" })} stroke-width="1.6" stroke-dasharray="4 3"/>`,
    );
  for (let t = lo; t <= hi + 1e-9; t += step) c.text(X(t), base + 15, num(t), 11, "ink-2", "middle");
  if ((sp.mark_mean ?? true) && Number.isFinite(mean)) {
    const mx = X(mean);
    c.add(`<path d="M${f1(mx)},${base + 20} l-7,12 h14 z"${c.paint({ fill: "data-hi" })}/>`);
    c.text(mx, base + 46, `平均 ${num(Number(mean.toFixed(2)))}${unit}`, 12, "data-hi", "middle", "bold");
  }
  y = base + 58;
  if (sp.overlay || sp.label) {
    c.line(8, y + 8, 20, y + 8, "data-1", 2.2);
    const lab = sp.label ?? short; // 凡例の名前の既定は分布の短い名前（t(5) など）
    c.text(24, y + 12, lab, 12, "ink-2");
    if (sp.overlay) {
      let ox = 190;
      if (lab.length > 14) {
        y += 20; // 長い凡例は次の行へ（重ならないように）
        ox = 8;
      }
      c.line(ox, y + 8, ox + 12, y + 8, "ink", 1.6, "4 3");
      c.text(ox + 16, y + 12, sp.overlay.label ?? "重ねる分布", 12, "ink-2");
    }
    y += 20;
    for (const line of sp.lines ?? []) {
      c.text(8, y + 12, line, 12.5, "ink");
      y += 20;
    }
  }
  if (sp.note) y = c.para(8, y + 10, sp.note, 344, 12.5, "ink-2");
  return c.done(
    y + 6,
    `${name} の曲線${Number.isFinite(mean) ? `。平均は ${num(Number(mean.toFixed(2)))}${unit}` : ""}`,
  );
}
