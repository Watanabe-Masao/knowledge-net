// 確かめる対象：観察の表の「回数」の行（実験・理論・ずれ）の数の書き方（fmtCount。stats2-course #200 の ⑥）。
// 想定する故障：理論の回数を整数に丸め、見えている数どうしの引き算が合わない（実験 29・理論 27・ずれ ＋2.3）。
// 見つけ方：実験の回数（整数）と理論の回数（小数）の組を広く取り、表に出る「実験 − 理論」が表に出る「ずれ」と同じになることを確かめる。
// 既存との違い：e2e の観察のテストは乱数で決まる1つの組しか見ず、桁の食い違いを狙っていない。
// 検出の確かめ（2026-11-18）：fmtCount を元の fmtN に戻すと 29・26.68 の組で落ちることを見た
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { fmtCount } from "../src/QuestionParts";

const shownDiff = (exp: number, th: number) => Number(fmtCount(Math.abs(exp - th)));

describe("回数の照らしの書き方", () => {
  it("29 回と理論 26.68 回は 29・26.7・2.3（引き算が合う）", () => {
    expect([fmtCount(29), fmtCount(26.68), fmtCount(29 - 26.68)]).toEqual(["29", "26.7", "2.3"]);
  });
  it("見えている 実験 − 理論 が、見えている ずれ と一致する", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100000 }), fc.double({ min: 0, max: 100000, noNaN: true }), (exp, th) => {
        const seen = Math.abs(exp - Number(fmtCount(th)));
        expect(Math.abs(seen - shownDiff(exp, th))).toBeLessThanOrEqual(0.1 + 1e-6);
      }),
    );
  });
});
