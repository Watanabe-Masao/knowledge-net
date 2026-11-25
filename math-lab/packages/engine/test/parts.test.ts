// 意味のかたまりと分布（#110）：かたまりは木の節を指し、かたまりの値の積が式の値、分布の和は1
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import formulas from "./fixtures/stats2-formulas.json";
import { distribution, evaluate, nodeAt, rhsOf, tailEnd, toTex, type Formula } from "../src";

const binom = (formulas as (Formula & { concept: string; index: number })[]).find(
  (f) => f.concept === "TERM-binom" && f.index === 0,
)!;

describe("意味のかたまり", () => {
  it("二項分布の3つのかたまりは ₙCₖ・pᵏ・(1−p)ⁿ⁻ᵏ", () => {
    expect(binom.parts!.map((p) => toTex(nodeAt(binom.tree, p.path)!, { symbols: binom.symbols }))).toEqual([
      "{}_{n}\\mathrm{C}_{k}",
      "p^{k}",
      "(1-p)^{n-k}",
    ]);
  });
  it("性質：かたまりの値の積が式の値（どの n・k・p でも）", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 30 }).chain((n) => fc.tuple(fc.constant(n), fc.integer({ min: 0, max: n }))),
        fc.double({ min: 0, max: 1, noNaN: true }),
        ([n, k], p) => {
          const values = { n, k, p };
          const prod = binom.parts!.reduce((a, part) => a * evaluate(nodeAt(binom.tree, part.path)!, { values })!, 1);
          expect(prod).toBeCloseTo(evaluate(rhsOf(binom.tree), { values })!, 12);
        },
      ),
      { numRuns: 200 },
    );
  });
  it("分布：k を 0〜n で動かした値の和は1", () => {
    const d = distribution(binom.tree, "k", 0, 10, { values: { n: 10, p: 0.3 } });
    expect(d.length).toBe(11);
    expect(d.reduce((s, x) => s + (x.y ?? 0), 0)).toBeCloseTo(1, 12);
  });
  it("木にない節を指す path は undefined", () => {
    expect(nodeAt(binom.tree, [1, 9])).toBeUndefined();
    expect(nodeAt(binom.tree, [0, 0, 0, 0])).toBeUndefined();
  });
});

// 確かめる対象：上限のない横軸の並べる範囲（tailEnd。stats2-course の issue 608）。
// 想定する故障：残りの確率を数え違えて図が早く切れる（大きな λ で山の右側が欠ける）・止まらずに回り続ける・下限が r などの記号のときに始まりを間違える。
// 見つけ方：教材のポアソン分布・幾何分布の式に、閉じた形の残り（幾何：(1−p)^hi。ポアソン：1 − Σ を別に計算）を照らす。期待値と式の値で独立に比べる。
// 検出の確かめ（2026-11-26）：足す前に止める比べ（1 − sum < eps）を ≤ 1 にすると、どの λ でも hi が lo のままで落ちることを見た
describe("上限のない横軸の並べる範囲", () => {
  const f = (c: string) =>
    (formulas as (Formula & { concept: string; index: number })[]).find((x) => x.concept === c && x.index === 0)!;
  it("性質：幾何分布は、並べた先の残りが閉じた形 (1−p)^hi と合い、cap の手前で止まれば eps 未満", () => {
    fc.assert(
      fc.property(fc.double({ min: 0.02, max: 0.98, noNaN: true }), (p) => {
        const { hi, tail } = tailEnd(f("TERM-geom").tree, "k", 1, { values: { p } });
        expect(Math.abs(tail - (1 - p) ** hi)).toBeLessThan(1e-9); // 返す残りは本当の残り（cap で止まったときも）
        // 止まった理由で分ける（hi が cap と同じ所で残りが eps 未満になることもあるので、hi では分けない。2026-11-26 に main で落ちた）
        if (tail < 1e-4)
          expect((1 - p) ** (hi - 1)).toBeGreaterThan(1e-4 * (1 - 1e-9)); // 1つ手前ではまだ残りが eps 以上（早く止まりすぎない・遅すぎない）
        else expect(hi).toBe(1 + 400); // 残りが eps 以上で止まるのは cap に着いたときだけ
      }),
      { examples: [[0.022706663421711907]] }, // 2026-11-26 に main で落ちた境目（cap と eps が同じ所）
    );
  });
  it("性質：ポアソン分布は、並べた分で期待値 λ をほぼ再現する（大きな λ でも山の右が欠けない）", () => {
    fc.assert(
      fc.property(fc.double({ min: 0.1, max: 60, noNaN: true }), (lambda) => {
        const t = f("TERM-poisson").tree;
        const { hi, tail } = tailEnd(t, "k", 0, { values: { lambda } });
        expect(tail).toBeLessThan(1e-4);
        const d = distribution(t, "k", 0, hi, { values: { lambda } });
        const m = d.reduce((s, x) => s + x.x * (x.y ?? 0), 0);
        expect(Math.abs(m - lambda) / lambda).toBeLessThan(1e-2);
        expect(hi).toBeGreaterThan(lambda);
      }),
    );
  });
  it("式の値が出ないときも cap で止まる", () => {
    const { hi, tail } = tailEnd({ sym: "q" }, "k", 0, {}, 1e-4, 50);
    expect(hi).toBe(50);
    expect(tail).toBe(1);
  });
});
