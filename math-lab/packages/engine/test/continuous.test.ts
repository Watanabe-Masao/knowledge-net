// 連続の分布（作業台のパターン3。stats2-course の issue 608）。
// 確かめる対象と想定する故障：
// 1 累積と密度の食い違い（密度の式・累積の式のどちらかの誤り）：密度を数値で積分した値と累積の差を比べる（同じ式を共有しない独立な求め方）
// 2 逆関数のずれ（q と F(F⁻¹(q)) が合わない）：性質で全部の q に当てる
// 3 向きの取り違え（以上と以下・間と外側を入れ替える）：補い合う向きの和が1、教科書の値（Φ(1.96)・e^(−1)）
// 4 標本の偏り（逆関数を通し忘れる・別の分布から引く）：区間に入った割合が確率に、平均が期待値に近づく（許す幅は標準誤差の5倍）
// 5 再現できない（Math.random を使う）：同じ種なら同じ並び
// 6 母数の範囲の外で黙って数を返す：理由つきで止まる
// 7 教材の式（Φ((b−μ)/σ)−Φ((a−μ)/σ)）の値と、作業台の結果（contProb）の食い違い：式の木を evaluate した値と比べる（端が ±∞ のときも）
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  checkFamily,
  contCdf,
  contDensity,
  contMoments,
  contProb,
  contQuantile,
  contWindow,
  createRandom,
  evaluate,
  type FormulaNode,
  sampleContinuous,
  type ContFamily,
} from "../src";

const family: fc.Arbitrary<ContFamily> = fc.oneof(
  fc.record({
    family: fc.constant("normal" as const),
    mu: fc.double({ min: -100, max: 100, noNaN: true }),
    sigma: fc.double({ min: 0.1, max: 50, noNaN: true }),
  }),
  fc.constant({ family: "std-normal" as const }),
  fc.record({ family: fc.constant("expo" as const), lam: fc.double({ min: 0.01, max: 20, noNaN: true }) }),
  fc
    .tuple(fc.double({ min: -100, max: 100, noNaN: true }), fc.double({ min: 0.1, max: 100, noNaN: true }))
    .map(([a, w]) => ({ family: "uniform" as const, a, b: a + w })),
);

/** 台形の和で ∫ₐᵇ f(x)dx（2000 区切り） */
function integrate(f: ContFamily, a: number, b: number) {
  const n = 2000,
    h = (b - a) / n;
  let s = (contDensity(f, a) + contDensity(f, b)) / 2;
  for (let i = 1; i < n; i++) s += contDensity(f, a + i * h);
  return s * h;
}

describe("連続の分布", () => {
  it("1 密度の積分が累積の差と同じ（窓の中の区間）", () => {
    fc.assert(
      fc.property(
        family,
        fc.double({ min: 0.05, max: 0.95, noNaN: true }),
        fc.double({ min: 0.05, max: 0.95, noNaN: true }),
        (f, q1, q2) => {
          const [lo, hi] = contWindow(f);
          const a = lo + (hi - lo) * Math.min(q1, q2),
            b = lo + (hi - lo) * Math.max(q1, q2);
          // 一様の台の端（密度が跳ぶ所）を区切りがまたぐと台形の誤差が幅 h ほど出るので、許す幅は区切り1つ分の面積
          const tol = f.family === "uniform" ? (2 * (b - a)) / 2000 / (f.b - f.a) + 1e-9 : 2e-6;
          expect(Math.abs(integrate(f, a, b) - (contCdf(f, b) - contCdf(f, a)))).toBeLessThan(tol);
        },
      ),
      { numRuns: 200 },
    );
  });
  it("2 逆関数を累積に通すと元の q（全部の q で）", () => {
    fc.assert(
      fc.property(family, fc.double({ min: 0.001, max: 0.999, noNaN: true }), (f, q) => {
        expect(contCdf(f, contQuantile(f, q))).toBeCloseTo(q, 6);
      }),
    );
  });
  it("3 向き：補い合う向きの和は1、教科書の値と同じ", () => {
    fc.assert(
      fc.property(
        family,
        fc.double({ min: -50, max: 50, noNaN: true }),
        fc.double({ min: 0, max: 30, noNaN: true }),
        (f, a, w) => {
          const b = a + w;
          expect(contProb(f, "le", 0, a) + contProb(f, "ge", a, 0)).toBeCloseTo(1, 12);
          expect(contProb(f, "between", a, b) + contProb(f, "out", a, b)).toBeCloseTo(1, 12);
          expect(contProb(f, "between", a, b)).toBeGreaterThanOrEqual(-1e-15);
        },
      ),
    );
    const z = { family: "std-normal" } as const;
    expect(contProb(z, "between", -1.96, 1.96)).toBeCloseTo(0.95, 3);
    expect(contProb(z, "le", -Infinity, 1.645)).toBeCloseTo(0.95, 3);
    expect(contProb({ family: "normal", mu: 60, sigma: 10 }, "ge", 80, Infinity)).toBeCloseTo(0.0228, 4);
    expect(contProb({ family: "expo", lam: 0.1 }, "le", 0, 10)).toBeCloseTo(1 - Math.exp(-1), 12);
    expect(contProb({ family: "uniform", a: 0, b: 12 }, "between", 0, 4)).toBeCloseTo(1 / 3, 12);
    expect(() => contProb(z, "between", 2, 1)).toThrow(/a ≦ b/);
  });
  it("4 標本：区間に入る割合と平均が理論に近づく（標準誤差の5倍）", () => {
    const cases: [ContFamily, number, number][] = [
      [{ family: "normal", mu: 500, sigma: 4 }, 496, 504],
      [{ family: "expo", lam: 0.1 }, 0, 4],
      [{ family: "uniform", a: 0, b: 12 }, 3, 5],
    ];
    for (const [f, a, b] of cases) {
      const rng = createRandom(20261128);
      const n = 20000,
        xs = Array.from({ length: n }, () => sampleContinuous(rng, f));
      const p = contProb(f, "between", a, b);
      const share = xs.filter((x) => x >= a && x <= b).length / n;
      expect(Math.abs(share - p)).toBeLessThan(5 * Math.sqrt((p * (1 - p)) / n));
      const { mean, sd } = contMoments(f);
      expect(Math.abs(xs.reduce((t, x) => t + x, 0) / n - mean)).toBeLessThan((5 * sd) / Math.sqrt(n));
    }
  });
  it("5 同じ種なら同じ並び", () => {
    const f: ContFamily = { family: "normal", mu: 0, sigma: 1 };
    const draw = (seed: number) => {
      const r = createRandom(seed);
      return Array.from({ length: 5 }, () => sampleContinuous(r, f));
    };
    expect(draw(7)).toEqual(draw(7));
    expect(draw(7)).not.toEqual(draw(8));
  });
  it("6 母数が範囲の外なら理由を言って止まる", () => {
    expect(checkFamily({ family: "normal", mu: 0, sigma: 0 })).toMatch(/σ/);
    expect(checkFamily({ family: "expo", lam: -1 })).toMatch(/λ/);
    expect(checkFamily({ family: "uniform", a: 3, b: 3 })).toMatch(/a＜b/);
    expect(() => contCdf({ family: "expo", lam: 0 }, 1)).toThrow(/範囲の外/);
    expect(() => contQuantile({ family: "std-normal" }, 1)).toThrow(/q は/);
  });
  it("7 教材の区間の式（Φ の差）の値が、区間の確率と同じ", () => {
    const phi = (n: FormulaNode): FormulaNode => ({ op: "fn", name: "Phi", args: [n] });
    const z = (e: string): FormulaNode => ({
      op: "div",
      args: [{ op: "sub", args: [{ sym: e }, { sym: "mu" }] }, { sym: "sigma" }],
    });
    const tree: FormulaNode = { op: "sub", args: [phi(z("b")), phi(z("a"))] };
    fc.assert(
      fc.property(
        fc.double({ min: -50, max: 50, noNaN: true }),
        fc.double({ min: 0.5, max: 20, noNaN: true }),
        fc.double({ min: -80, max: 80, noNaN: true }),
        fc.double({ min: 0, max: 40, noNaN: true }),
        (mu, sigma, a, w) => {
          const f: ContFamily = { family: "normal", mu, sigma };
          expect(evaluate(tree, { values: { mu, sigma, a, b: a + w } })).toBeCloseTo(
            contProb(f, "between", a, a + w),
            12,
          );
          expect(evaluate(tree, { values: { mu, sigma, a: -Infinity, b: a } })).toBeCloseTo(
            contProb(f, "le", 0, a),
            12,
          );
        },
      ),
    );
  });
});
