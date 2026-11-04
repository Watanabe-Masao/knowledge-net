// 解き方を組み立てる公式の部品（stats2-course #181）。
// 確かめる対象：計算の行の値・導いた値を次の公式へ運ぶ（derive）・当てはめる値が足りないときに止まること。
// 想定する故障：成功・失敗の部分の指数の取り違え（pᵏ と pⁿ⁻ᵏ）・導いた値が次の公式に入らない・記号の穴の取り違え。
// 見つけ方：手計算の値（0.7¹⁰＝0.0282475…・₁₀C₃＝120・0.7⁷＝0.0823543・50×0.0282475…＝1.412…）と照らす。
// 既存との違い：solveApply の答えは apply.test.ts。ここは解き方の部品が同じ値を別の道で出すか
import { describe, expect, it } from "vitest";
import { solveApply, walkCompute, type ApplySolve, type WalkFormulaUse } from "../src";

describe("解き方の公式の部品", () => {
  it("ちょうど k 回：並び方・成功・失敗・積（手計算）", () => {
    const [r] = walkCompute([{ id: "one", ref: "binom.pmf", bind: { n: "n", k: "k", p: "p" } }], {
      n: 10,
      k: 3,
      p: 0.3,
    });
    expect(r!.rows.map((x) => x.tex)).toEqual([
      "{}_{10}\\mathrm{C}_{3}=120",
      "0.3^{3}=0.027",
      "0.7^{7}\\approx0.0824",
      "120\\times0.027\\times0.0824\\approx0.2668",
    ]);
    expect(r!.value).toBeCloseTo(120 * 0.027 * 0.0823543, 12);
  });
  it("導いた値を次の公式へ運ぶ（1人の確率 → 50 人の平均）", () => {
    const out = walkCompute(
      [
        { id: "one", ref: "binom.pmf", bind: { n: "n", k: "k", p: "p" } },
        { id: "all", ref: "binom.mean", bind: { n: "N", p: "one" } },
      ],
      { n: 10, k: 10, p: 0.7, N: 50 },
    );
    expect(out[0]!.rows[2]!.variant).toBe("zero"); // 失敗が 0 回（文は教材の walk_texts の別の言い方）
    expect(out[1]!.value).toBeCloseTo(50 * 0.0282475249, 9);
  });
  it("逆算と分散", () => {
    expect(
      walkCompute([{ id: "p", ref: "binom.mean-p", bind: { E: "e", n: "n" } }], { e: 6, n: 20 })[0]!.value,
    ).toBeCloseTo(0.3, 12);
    const v = walkCompute(
      [
        { id: "a", ref: "binom.var", bind: { n: "an", p: "ap" } },
        { id: "b", ref: "binom.var", bind: { n: "bn", p: "bp" } },
      ],
      { an: 10, ap: 0.6, bn: 20, bp: 0.3 },
    );
    expect(v.map((x) => x.value)).toEqual([expect.closeTo(2.4, 12), expect.closeTo(4.2, 12)]);
  });
  it("当てはめる値がない・知らない公式は止まる", () => {
    expect(() => walkCompute([{ id: "x", ref: "binom.mean", bind: { n: "n" } }], { n: 3 })).toThrow(/記号 p/);
    expect(() => walkCompute([{ id: "x", ref: "binom.none", bind: {} }], {})).toThrow(/知らない/);
  });
});

// 式の形の穴（@n）：TeX の括弧（\mathrm{C} など）を穴と取り違えない。故障：\mathrm{C} の C を穴として置き換え、式が赤い文字になる（実際に起きた）
describe("式の形の穴", () => {
  it("どの公式も、穴は記号の @ だけで、記号の数がそろう", async () => {
    const { WALK_FORMULAS } = await import("../src");
    for (const def of Object.values(WALK_FORMULAS)) {
      const holes = [...new Set([...def.tex.matchAll(/@([A-Za-z])/g)].map((m) => m[1]))].sort();
      expect(holes).toEqual([...def.syms].sort());
      expect(def.tex).not.toMatch(/\{[nkpE]\}/); // 古い形 {n} の穴が残っていない
    }
  });
});

// 応用の全部の課題（stats2-course #181 の横展開）。確かめる対象：解き方の部品をつないで出した最後の値が、solveApply の答えと同じこと。
// 想定する故障：部品の式の誤り（4P(1−P)/e² の 4 を落とす・(n+1)p を np にする・余事象の取り違え・単位への切り上げ忘れ）。
// 見つけ方：solveApply（理論の分布を数え上げる・全部の刻みを試す）と、部品（閉じた式）の別の道で比べる。小さな数が 0 に見えないことも見る。
// 既存との違い：上は二項分布の確率・平均・分散の部品。ここは応用の残りの課題で使う部品
describe("応用の課題ごとの解き方（solveApply と照らす）", () => {
  const cases: [string, WalkFormulaUse[], Record<string, number>, ApplySolve][] = [
    [
      "A-02",
      [{ id: "n", ref: "share.sd-n", bind: { p: "p", s: "s" } }],
      { p: 0.3, s: 0.08 },
      { method: "min-n-share-sd", p: 0.3, sd: 0.08 },
    ],
    [
      "A-03",
      [{ id: "k", ref: "binom.mode", bind: { n: "n", p: "p" } }],
      { n: 10, p: 0.8 },
      { method: "mode", n: 10, p: 0.8 },
    ],
    [
      "A-03 整数の境目",
      [{ id: "k", ref: "binom.mode", bind: { n: "n", p: "p" } }],
      { n: 9, p: 0.5 },
      { method: "mode", n: 9, p: 0.5 },
    ],
    [
      "C-02",
      [
        { id: "q", ref: "binom.ge", bind: { k: "k", n: "n", p: "p" } },
        { id: "N", ref: "sets.n", bind: { P: "q", e: "e", u: "u" } },
      ],
      { k: 4, n: 10, p: 0.3, e: 0.01, u: 100 },
      { method: "sets-for-error", n: 10, p: 0.3, event: { op: "ge", k: 4 }, err: 0.01, unit: 100 },
    ],
    [
      "D-01",
      [
        { id: "E", ref: "binom.mean", bind: { n: "n", p: "p" } },
        { id: "Y", ref: "lin.sum", bind: { a: "a", E: "E", b: "b", n: "n" } },
      ],
      { n: 10, p: 0.3, a: 200, b: -50 },
      { method: "linear-sum", n: 10, p: 0.3, a: 200, b: -50 },
    ],
    [
      "E-02",
      [{ id: "c", ref: "streak.max", bind: { n: "n", r: "r", h: "h" } }],
      { n: 10, r: 1.1, h: 0.05 },
      {
        method: "max-strength",
        mechanism: { kind: "streak", n: 10, p: 0.5, carry: 0 },
        param: "carry",
        min: 0.05,
        max: 0.6,
        step: 0.05,
        ratio: 1.1,
      },
    ],
    [
      "E-02 倍率 1.2（答えがいちばん小さい刻みと違う）",
      [{ id: "c", ref: "streak.max", bind: { n: "n", r: "r", h: "h" } }],
      { n: 10, r: 1.2, h: 0.05 },
      {
        method: "max-strength",
        mechanism: { kind: "streak", n: 10, p: 0.5, carry: 0 },
        param: "carry",
        min: 0.05,
        max: 0.6,
        step: 0.05,
        ratio: 1.2,
      },
    ],
    [
      "A-03 13 回（平均の四捨五入と違う）",
      [{ id: "k", ref: "binom.mode", bind: { n: "n", p: "p" } }],
      { n: 13, p: 0.8 },
      { method: "mode", n: 13, p: 0.8 },
    ],
    [
      "E-03",
      [{ id: "N", ref: "fpc.N", bind: { n: "n", r: "r", u: "u" } }],
      { n: 10, r: 0.8, u: 2 },
      { method: "min-total", n: 10, ratio: 0.8, step: 2 },
    ],
    [
      "E-04",
      [
        { id: "bv", ref: "binom.var", bind: { n: "n", p: "p" } },
        { id: "d", ref: "mix.d", bind: { V: "v", B: "bv", n: "n" } },
      ],
      { n: 10, p: 0.5, v: 3.4 },
      { method: "solve-spread", n: 10, p: 0.5, variance: 3.4 },
    ],
  ];
  it.each(cases)("%s：最後の値が答えと同じ", (_, f, info, sv) => {
    const out = walkCompute(f, info);
    expect(out[out.length - 1]!.value).toBeCloseTo(solveApply(sv).answer, 9);
  });
  it("選ぶ答えの課題は、比べる値が solveApply の facts と同じ（B-01 の比・C-01 の z・E-01 の分散）", () => {
    const b = walkCompute(
      [
        { id: "a", ref: "binom.pmf", bind: { n: "an", k: "ak", p: "p" } },
        { id: "b", ref: "binom.pmf", bind: { n: "bn", k: "bk", p: "p" } },
        { id: "r", ref: "ratio", bind: { A: "a", B: "b" } },
      ],
      { an: 10, ak: 3, bn: 30, bk: 9, p: 0.3 },
    );
    expect(b[2]!.value).toBeCloseTo(
      solveApply({ method: "compare-eq", a: { n: 10, p: 0.3, k: 3 }, b: { n: 30, p: 0.3, k: 9 } }).facts.ratio!,
      9,
    );
    expect(b[1]!.rows.find((r) => r.key === "succ")!.tex).toBe("0.3^{9}\\approx0.0000197"); // 小さな数が 0 に見えない
    const z = walkCompute(
      [
        { id: "se", ref: "share.se", bind: { P: "P", m: "m" } },
        { id: "z", ref: "share.z", bind: { x: "x", m: "m", P: "P", S: "se" } },
      ],
      { P: 0.2, m: 100, x: 27 },
    );
    expect(z[1]!.value).toBeCloseTo(solveApply({ method: "within-band", P: 0.2, m: 100, x: 27 }).facts.z!, 9);
    const w = walkCompute([{ id: "w", ref: "fatigue.var", bind: { n: "n", F: "f", L: "l" } }], {
      n: 10,
      f: 0.8,
      l: 0.2,
    });
    expect(w[0]!.value).toBeCloseTo(
      solveApply({ method: "binom-judge", mechanism: { kind: "fatigue", n: 10, p: 0.5, drop: 0.3 } }).facts.variance!,
      9,
    );
  });
});
