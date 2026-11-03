// 解き方を組み立てる公式の部品（stats2-course #181）。
// 確かめる対象：計算の行の値・導いた値を次の公式へ運ぶ（derive）・当てはめる値が足りないときに止まること。
// 想定する故障：成功・失敗の部分の指数の取り違え（pᵏ と pⁿ⁻ᵏ）・導いた値が次の公式に入らない・記号の穴の取り違え。
// 見つけ方：手計算の値（0.7¹⁰＝0.0282475…・₁₀C₃＝120・0.7⁷＝0.0823543・50×0.0282475…＝1.412…）と照らす。
// 既存との違い：solveApply の答えは apply.test.ts。ここは解き方の部品が同じ値を別の道で出すか
import { describe, expect, it } from "vitest";
import { walkCompute } from "../src";

describe("解き方の公式の部品", () => {
  it("ちょうど k 回：並び方・成功・失敗・積（手計算）", () => {
    const [r] = walkCompute([{ id: "one", ref: "binom.pmf", bind: { n: "n", k: "k", p: "p" } }], { n: 10, k: 3, p: 0.3 });
    expect(r!.rows.map((x) => x.tex)).toEqual(["{}_{10}\\mathrm{C}_{3}=120", "0.3^{3}=0.027", "0.7^{7}\\approx0.0824", "120\\times0.027\\times0.0824\\approx0.2668"]);
    expect(r!.value).toBeCloseTo(120 * 0.027 * 0.0823543, 12);
  });
  it("導いた値を次の公式へ運ぶ（1人の確率 → 50 人の平均）", () => {
    const out = walkCompute([
      { id: "one", ref: "binom.pmf", bind: { n: "n", k: "k", p: "p" } },
      { id: "all", ref: "binom.mean", bind: { n: "N", p: "one" } },
    ], { n: 10, k: 10, p: 0.7, N: 50 });
    expect(out[0]!.rows[2]!.why).toContain("0 でない数の 0 乗は 1");
    expect(out[1]!.value).toBeCloseTo(50 * 0.0282475249, 9);
  });
  it("逆算と分散", () => {
    expect(walkCompute([{ id: "p", ref: "binom.mean-p", bind: { E: "e", n: "n" } }], { e: 6, n: 20 })[0]!.value).toBeCloseTo(0.3, 12);
    const v = walkCompute([{ id: "a", ref: "binom.var", bind: { n: "an", p: "ap" } }, { id: "b", ref: "binom.var", bind: { n: "bn", p: "bp" } }], { an: 10, ap: 0.6, bn: 20, bp: 0.3 });
    expect(v.map((x) => x.value)).toEqual([expect.closeTo(2.4, 12), expect.closeTo(4.2, 12)]);
  });
  it("当てはめる値がない・知らない公式は止まる", () => {
    expect(() => walkCompute([{ id: "x", ref: "binom.mean", bind: { n: "n" } }], { n: 3 })).toThrow(/記号 p/);
    expect(() => walkCompute([{ id: "x", ref: "binom.mode", bind: {} }], {})).toThrow(/知らない/);
  });
});

// 式の形の穴（@n）：TeX の括弧（\mathrm{C} など）を穴と取り違えない。故障：\mathrm{C} の C を穴として置き換え、式が赤い文字になる（実際に起きた）
describe("式の形の穴", () => {
  it("どの公式も、穴は記号の @ だけで、記号の数がそろう", async () => {
    const { WALK_FORMULAS } = await import("../src");
    for (const def of Object.values(WALK_FORMULAS)) {
      const holes = [...new Set([...def.tex.matchAll(/@([A-Za-z])/g)].map((m) => m[1]))].sort();
      expect(holes).toEqual([...def.syms].sort());
      expect(def.tex).not.toMatch(/\{[nkpE]\}/);   // 古い形 {n} の穴が残っていない
    }
  });
});
