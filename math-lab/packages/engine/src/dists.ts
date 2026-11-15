// t・カイ二乗・F 分布の密度・分布関数・確率点（stats2-course #47 の U20）。
// 教材の t・χ²・F ラボ（tools/tcf_lab）と同じ方法（Numerical Recipes の不完全ベータ・不完全ガンマ関数と二分法）で、画面の場面とラボの値をそろえる。

/** ln Γ(x)（x＞0。Lanczos の近似） */
export function lnGamma(x: number): number {
  const c = [
    76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2,
    -0.5395239384953e-5,
  ];
  let y = x,
    t = x + 5.5;
  t -= (x + 0.5) * Math.log(t);
  let s = 1.000000000190015;
  for (const ci of c) s += ci / ++y;
  return -t + Math.log((2.5066282746310005 * s) / x);
}

function betacf(a: number, b: number, x: number): number {
  const FP = 1e-300,
    qab = a + b,
    qap = a + 1,
    qam = a - 1;
  let c = 1,
    d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FP) d = FP;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FP) d = FP;
    c = 1 + aa / c;
    if (Math.abs(c) < FP) c = FP;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FP) d = FP;
    c = 1 + aa / c;
    if (Math.abs(c) < FP) c = FP;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 3e-14) break;
  }
  return h;
}

/** 正則化不完全ベータ関数 I_x(a, b) */
export function incBeta(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? (bt * betacf(a, b, x)) / a : 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/** 正則化不完全ガンマ関数 P(a, x) */
export function incGamma(a: number, x: number): number {
  if (x <= 0) return 0;
  if (x < a + 1) {
    let ap = a,
      s = 1 / a,
      d = s;
    for (let n = 0; n < 500; n++) {
      ap++;
      d *= x / ap;
      s += d;
      if (Math.abs(d) < Math.abs(s) * 3e-15) break;
    }
    return s * Math.exp(-x + a * Math.log(x) - lnGamma(a));
  }
  let b = x + 1 - a,
    c = 1 / 1e-300,
    d = 1 / b,
    h = d;
  for (let i = 1; i < 500; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < 1e-300) d = 1e-300;
    c = b + an / c;
    if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 3e-15) break;
  }
  return 1 - Math.exp(-x + a * Math.log(x) - lnGamma(a)) * h;
}

/** 自由度は正の数（0 以下・NaN は分布が定まらない。math-lab の守ること 3） */
const needDf = (...dfs: number[]) => {
  for (const d of dfs) if (!(d > 0)) throw new Error(`自由度は正の数（${d}）`);
};
const bisect = (cdf: (x: number) => number, p: number, lo: number, hi: number) => {
  if (!(p > 0 && p < 1)) throw new Error(`確率点の p は 0 と 1 の間（${p}）`);
  while (cdf(hi) < p && hi < 1e12) hi *= 10; // 上限を超える点（F(1, 1) の 0.999 点など）は上限を広げる
  for (let i = 0; i < 200; i++) {
    const m = (lo + hi) / 2;
    if (cdf(m) < p) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
};

/** t 分布 t(df) の密度・分布関数・左側累積 p の点 */
export const tDensity = (t: number, df: number) =>
  Math.exp(
    lnGamma((df + 1) / 2) -
      lnGamma(df / 2) -
      0.5 * Math.log(df * Math.PI) -
      ((df + 1) / 2) * Math.log(1 + (t * t) / df),
  );
export function tCdf(t: number, df: number): number {
  needDf(df);
  const tail = 0.5 * incBeta(df / 2, 0.5, df / (df + t * t));
  return t > 0 ? 1 - tail : tail;
}
export const tQuantile = (p: number, df: number) =>
  p === 0.5 ? 0 : p > 0.5 ? bisect((t) => tCdf(t, df), p, 0, 1e3) : -bisect((t) => tCdf(t, df), 1 - p, 0, 1e3);

/** カイ二乗分布 χ²(df) */
export const chi2Density = (x: number, df: number) =>
  x <= 0 ? 0 : Math.exp((df / 2 - 1) * Math.log(x) - x / 2 - (df / 2) * Math.log(2) - lnGamma(df / 2));
export const chi2Cdf = (x: number, df: number) => (needDf(df), incGamma(df / 2, x / 2));
export const chi2Quantile = (p: number, df: number) =>
  bisect((q) => chi2Cdf(q, df), p, 0, df + 200 * Math.sqrt(2 * df) + 100);

/** F 分布 F(d1, d2) */
export const fDensity = (x: number, d1: number, d2: number) =>
  x <= 0
    ? 0
    : Math.exp(
        0.5 * (d1 * Math.log(d1 * x) + d2 * Math.log(d2) - (d1 + d2) * Math.log(d1 * x + d2)) -
          Math.log(x) -
          (lnGamma(d1 / 2) + lnGamma(d2 / 2) - lnGamma((d1 + d2) / 2)),
      );
export const fCdf = (x: number, d1: number, d2: number) =>
  x <= 0 ? 0 : incBeta(d1 / 2, d2 / 2, (d1 * x) / (d1 * x + d2));
export const fQuantile = (p: number, d1: number, d2: number) => bisect((x) => fCdf(x, d1, d2), p, 0, 1e4);
