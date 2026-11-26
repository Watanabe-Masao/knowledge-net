// 意味のかたまりと分布（#110）：かたまりは木の節を指し、かたまりの値の積が式の値、分布の和は1
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import formulas from "./fixtures/stats2-formulas.json";
import { distribution, evaluate, nodeAt, rhsOf, spanOf, toTex, type Formula } from "../src";

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

// 確かめる対象：上限のない横軸の窓と、分布の平均・標準偏差（spanOf。stats2-course の issue 608）。
// 想定する故障：標準偏差を窓で切った分布から出して小さく出る（2026-11-26 の独立な確かめ：幾何 p＝0.01 で 83.3、真は 99.5）・
//   山が遠い分布（負の二項 r＝30・p＝0.01。平均 3000）で窓が下の端に貼りつき、棒が全部 0 になる・窓の外の確率を数え違える。
// 見つけ方：閉じた形の平均・標準偏差（幾何 1/p・√(1−p)/p、ポアソン λ・√λ、負の二項 r/p・√(r(1−p))/p）と照らす。窓の外の確率は窓の中の和と足して 1。
// 検出の確かめ（2026-11-26）：標準偏差を窓の中だけで求める形にすると幾何の性質で、窓を下の端から取る形にすると負の二項で落ちることを見た
describe("上限のない横軸の窓と、平均・標準偏差", () => {
  const f = (c: string) =>
    (formulas as (Formula & { concept: string; index: number })[]).find((x) => x.concept === c && x.index === 0)!;
  const inside = (t: Formula["tree"], from: number, to: number, values: Record<string, number>) =>
    distribution(t, "k", from, to, { values }).reduce((s, x) => s + (x.y ?? 0), 0);
  it("性質：幾何分布の平均・標準偏差は閉じた形と合い、窓の外の確率は窓の中と足して 1", () => {
    fc.assert(
      fc.property(fc.double({ min: 0.01, max: 0.98, noNaN: true }), (p) => {
        const t = f("TERM-geom").tree;
        const r = spanOf(t, "k", 1, { values: { p } });
        expect(Math.abs(r.mean - 1 / p) / (1 / p)).toBeLessThan(1e-6);
        expect(Math.abs(r.sd - Math.sqrt(1 - p) / p) / (Math.sqrt(1 - p) / p)).toBeLessThan(1e-6);
        expect(Math.abs(r.below + r.above + inside(t, r.from, r.to, { p }) - 1)).toBeLessThan(1e-9);
        expect(r.to - r.from + 1).toBeLessThanOrEqual(400);
        if (r.to - r.from + 1 < 400) expect(r.above).toBeLessThan(5e-5);
      }),
    );
  });
  it("性質：ポアソン分布の平均・標準偏差は λ・√λ と合う", () => {
    fc.assert(
      fc.property(fc.double({ min: 0.1, max: 60, noNaN: true }), (lambda) => {
        const r = spanOf(f("TERM-poisson").tree, "k", 0, { values: { lambda } });
        expect(Math.abs(r.mean - lambda) / lambda).toBeLessThan(1e-6);
        expect(Math.abs(r.sd - Math.sqrt(lambda)) / Math.sqrt(lambda)).toBeLessThan(1e-6);
        expect(r.below + r.above).toBeLessThan(1e-4);
      }),
    );
  });
  it("山が遠い分布（負の二項 r＝30・p＝0.01）でも、窓は山を含み、幅は 400 本まで", () => {
    const t = f("TERM-negbinom").tree;
    const r = spanOf(t, "k", 30, { values: { r: 30, p: 0.01 } });
    expect(Math.abs(r.mean - 3000) / 3000).toBeLessThan(1e-6);
    expect(Math.abs(r.sd - Math.sqrt(30 * 0.99) / 0.01) / (Math.sqrt(30 * 0.99) / 0.01)).toBeLessThan(1e-6);
    expect(r.from).toBeLessThan(3000);
    expect(r.to).toBeGreaterThan(3000);
    expect(r.to - r.from + 1).toBe(400);
    expect(Math.abs(r.below + r.above + inside(t, r.from, r.to, { r: 30, p: 0.01 }) - 1)).toBeLessThan(1e-9);
  });
});
