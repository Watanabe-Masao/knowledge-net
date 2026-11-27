// 連続の分布（作業台のパターン3。stats2-course の issue 608）：密度・累積・逆関数・区間の確率・種つきの標本。
// 画面を持たない純粋関数。標本は逆関数法（一様な数 u を逆関数に通す）で、種が同じなら同じ並びになる。
// 正規は Φ・Φ⁻¹（lab.ts）、一様・指数は閉じた形。
import { normalCdf, normalDensity, normalQuantile } from "./lab";
import type { Random } from "./random";

export type ContFamily =
  | { family: "normal"; mu: number; sigma: number }
  | { family: "std-normal" }
  | { family: "expo"; lam: number }
  | { family: "uniform"; a: number; b: number };

/** 区間の向き：以下（X≦b）・以上（X≧a）・間（a≦X≦b）・外側（X≦a または X≧b） */
export type Direction = "le" | "ge" | "between" | "out";
export const DIRECTIONS: Direction[] = ["le", "ge", "between", "out"];

/** 母数が分布の範囲の中か（外なら理由。止まり理由を言う） */
export function checkFamily(f: ContFamily): string | undefined {
  switch (f.family) {
    case "normal":
      return Number.isFinite(f.mu) && f.sigma > 0 && Number.isFinite(f.sigma) ? undefined : "σ は0より大きい";
    case "std-normal":
      return undefined;
    case "expo":
      return f.lam > 0 && Number.isFinite(f.lam) ? undefined : "λ は0より大きい";
    case "uniform":
      return Number.isFinite(f.a) && Number.isFinite(f.b) && f.a < f.b ? undefined : "a＜b";
  }
}

function must(f: ContFamily) {
  const why = checkFamily(f);
  if (why) throw new Error(`連続の分布の母数が範囲の外：${why}`);
}

/** 平均と標準偏差 */
export function contMoments(f: ContFamily): { mean: number; sd: number } {
  must(f);
  switch (f.family) {
    case "normal":
      return { mean: f.mu, sd: f.sigma };
    case "std-normal":
      return { mean: 0, sd: 1 };
    case "expo":
      return { mean: 1 / f.lam, sd: 1 / f.lam };
    case "uniform":
      return { mean: (f.a + f.b) / 2, sd: (f.b - f.a) / Math.sqrt(12) };
  }
}

/** 密度 f(x)（台の外は0） */
export function contDensity(f: ContFamily, x: number): number {
  must(f);
  switch (f.family) {
    case "normal":
      return normalDensity(x, f.mu, f.sigma);
    case "std-normal":
      return normalDensity(x, 0, 1);
    case "expo":
      return x >= 0 ? f.lam * Math.exp(-f.lam * x) : 0;
    case "uniform":
      return x >= f.a && x <= f.b ? 1 / (f.b - f.a) : 0;
  }
}

/** 累積 F(x)＝P(X≦x)。x は ±∞ でもよい */
export function contCdf(f: ContFamily, x: number): number {
  must(f);
  if (x === -Infinity) return 0;
  if (x === Infinity) return 1;
  switch (f.family) {
    case "normal":
      return normalCdf((x - f.mu) / f.sigma);
    case "std-normal":
      return normalCdf(x);
    case "expo":
      return x <= 0 ? 0 : 1 - Math.exp(-f.lam * x);
    case "uniform":
      return x <= f.a ? 0 : x >= f.b ? 1 : (x - f.a) / (f.b - f.a);
  }
}

/** 逆関数 F⁻¹(q)。q は 0 より大きく 1 より小さい */
export function contQuantile(f: ContFamily, q: number): number {
  must(f);
  if (!(q > 0 && q < 1)) throw new Error(`q は 0 より大きく 1 より小さい：${q}`);
  switch (f.family) {
    case "normal":
      return f.mu + f.sigma * normalQuantile(q);
    case "std-normal":
      return normalQuantile(q);
    case "expo":
      return -Math.log(1 - q) / f.lam;
    case "uniform":
      return f.a + q * (f.b - f.a);
  }
}

/** 向きと境目から区間の確率。以下は b だけ、以上は a だけを使う。間・外側は a≦b（逆なら入れ替えない：止める） */
export function contProb(f: ContFamily, dir: Direction, a: number, b: number): number {
  switch (dir) {
    case "le":
      return contCdf(f, b);
    case "ge":
      return 1 - contCdf(f, a);
    case "between":
    case "out": {
      if (!(a <= b)) throw new Error(`区間の端は a ≦ b：${a}, ${b}`);
      const p = contCdf(f, b) - contCdf(f, a);
      return dir === "between" ? p : 1 - p;
    }
  }
}

/** 図に描く横の窓：正規は平均±4σ、指数は 0〜F⁻¹(0.999)、一様は台の左右に幅の 15% ずつ */
export function contWindow(f: ContFamily): [number, number] {
  const { mean, sd } = contMoments(f);
  switch (f.family) {
    case "normal":
    case "std-normal":
      return [mean - 4 * sd, mean + 4 * sd];
    case "expo":
      return [0, contQuantile(f, 0.999)];
    case "uniform": {
      const w = f.b - f.a;
      return [f.a - 0.15 * w, f.b + 0.15 * w];
    }
  }
}

/** 種つきの標本1つ（逆関数法。u＝0 は引き直す） */
export function sampleContinuous(rng: Random, f: ContFamily): number {
  must(f);
  let u = 0;
  while (u === 0) u = rng.next();
  return contQuantile(f, u);
}
