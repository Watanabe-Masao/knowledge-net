// t・カイ二乗・F 分布（engine/dists.ts。stats2-course #47 の U20）。
// 確かめる対象：分布関数・確率点・密度。教材のラボ（tcf_lab）と同じ方法で作ったので、ここではラボの写しと比べず、別の道の値と比べる。
// 想定する故障：不完全ベータ関数の引数の入れ違い（a・b、x と 1−x）・t の片側と両側の取り違え・F の自由度の入れ違い・密度の正規化の誤り。
// 見つけ方：閉じた式（t(1) はコーシー分布 1/2＋arctan(t)/π、χ²(2) は 1−e^{−x/2}）、数表の値（t(4)・t(15) の0.975点、χ²(1) の0.95点＝1.96²）、
//   性質（F(1,k) の0.95点＝t(k) の0.975点の2乗〔④-9〕、F の自由度を入れ替えた分布関数の対称、密度の面積が1、自由度が大きいと正規分布）。
// 既存との違い：ほかの分布（二項・ポアソン・正規）は lab.ts。ここは標本分布の3つ。
// 検出の確かめ（2026-11-16）：tCdf の incBeta の a と b を入れ替えると、t(1)・数表・④-9 で落ちることを見た
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  chi2Cdf,
  chi2Density,
  chi2Quantile,
  fCdf,
  fDensity,
  fQuantile,
  normalCdf,
  tCdf,
  tDensity,
  tQuantile,
} from "../src";

const area = (f: (x: number) => number, a: number, b: number, m = 4000) => {
  const h = (b - a) / m;
  let s = 0;
  for (let i = 0; i <= m; i++) s += (i === 0 || i === m ? 1 : i % 2 ? 4 : 2) * f(a + i * h);
  return (s * h) / 3;
};

describe("t・カイ二乗・F 分布", () => {
  it("t(1) はコーシー分布：分布関数が 1/2＋arctan(t)/π", () => {
    for (const t of [-3, -1, 0.5, 2, 10]) expect(tCdf(t, 1)).toBeCloseTo(0.5 + Math.atan(t) / Math.PI, 10);
  });
  it("数表の値：t(4)・t(15) の0.975点、χ²(1) の0.95点", () => {
    expect(tQuantile(0.975, 4)).toBeCloseTo(2.7764, 4);
    expect(tQuantile(0.975, 15)).toBeCloseTo(2.1314, 4);
    expect(chi2Quantile(0.95, 1)).toBeCloseTo(1.959964 ** 2, 4);
  });
  it("χ²(2) の分布関数は 1−e^{−x/2}", () => {
    for (const x of [0.1, 1, 3, 8]) expect(chi2Cdf(x, 2)).toBeCloseTo(1 - Math.exp(-x / 2), 10);
  });
  it("F(1, k) の0.95点は t(k) の0.975点の2乗（④-9）", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 60 }), (k) => {
        expect(fQuantile(0.95, 1, k)).toBeCloseTo(tQuantile(0.975, k) ** 2, 4);
      }),
      { numRuns: 30 },
    );
  });
  it("F の自由度を入れ替えると、分布関数は 1−F(1/x) に移る", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 30 }),
        fc.integer({ min: 1, max: 30 }),
        fc.double({ min: 0.05, max: 20, noNaN: true }),
        (a, b, x) => {
          expect(fCdf(x, a, b)).toBeCloseTo(1 - fCdf(1 / x, b, a), 8);
        },
      ),
      { numRuns: 60 },
    );
  });
  it("密度の面積が1（t(5)・χ²(4)・F(3, 10)）", () => {
    expect(area((t) => tDensity(t, 5), -200, 200, 40000)).toBeCloseTo(1, 3);
    expect(area((x) => chi2Density(x, 4), 0, 80)).toBeCloseTo(1, 6);
    expect(area((x) => fDensity(x, 3, 10), 0, 400, 40000)).toBeCloseTo(1, 3);
  });
  it("自由度が大きいと、t 分布は標準正規分布に近づく", () => {
    expect(Math.abs(tCdf(1.96, 1e5) - normalCdf(1.96))).toBeLessThan(1e-4);
    expect(Math.abs(tCdf(1.96, 5) - normalCdf(1.96))).toBeGreaterThan(0.01);
  });
});
