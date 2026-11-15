// 平均の差・対応あり（モード diff・paired。教材の2群のラボ。stats2-course #47 の U23）。
// 確かめる対象：差の区間の標準誤差と自由度（ウェルチは近似の自由度、等分散は n₁＋n₂−2、対応ありは n−1）。
// 想定する故障：ウェルチの自由度を n₁＋n₂−2 にする（区間が狭すぎる）・対応ありで2群の SE を使う・t 検定ラボの paired の状態を区間として描く。
// 見つけ方：手で出した値（x̄₁＝53・x̄₂＝50・s＝10・n＝10ずつ：SE √20≒4.472、ウェルチの自由度はちょうど18。
//   s₁＝2・n₁＝30・s₂＝10・n₂＝6：自由度 (4/30＋100/6)²÷((4/30)²/29＋(100/6)²/5)≒5.08。対応あり D̄＝3・s_D＝2・n＝10：SE 0.632）。
// 既存との違い：ほかの場面は1標本。ここは2群の差の SE と自由度の取り違え。
// 検出の確かめ（2026-11-16）：ウェルチの自由度を n₁＋n₂−2 にすると2つ目が落ちることを見た
import { describe, expect, it } from "vitest";
import { drawScene } from "../src";

const val = (d: ReturnType<typeof drawScene>, k: string) => d!.stats.find((s) => s.key === k)!.value;

describe("2群の区間の場面", () => {
  it("diff：同じ s・n の2群なら SE √20、ウェルチの自由度は 18", () => {
    const d = drawScene("diff", { method: "welch", x1: 53, s1: 10, n1: 10, x2: 50, s2: 10, n2: 10 }, undefined, 3);
    expect([val(d, "diff"), val(d, "se"), val(d, "df")]).toEqual(["3", "4.472", "18"]);
    expect(d!.view).toMatchObject({ kind: "interval", zero: true });
  });
  it("diff：ばらつきの大きい少人数の群があると、ウェルチの自由度はその群の n−1 に近い（約5.08）", () => {
    const d = drawScene("diff", { method: "welch", x1: 40, s1: 2, n1: 30, x2: 36, s2: 10, n2: 6 }, undefined, 3);
    expect(val(d, "df")).toBe("5.08");
    expect(
      val(drawScene("diff", { method: "pooled", x1: 40, s1: 2, n1: 30, x2: 36, s2: 10, n2: 6 }, undefined, 3), "df"),
    ).toBe("34");
  });
  it("paired：差の SE は s_D÷√n、t 検定ラボの状態（side・alpha）は止める", () => {
    expect(val(drawScene("paired", { dbar: 3, sd: 2, n: 10 }, undefined, 3), "se")).toBe("0.632");
    expect(() => drawScene("paired", { dbar: 3, sd: 2, n: 10, side: "two", alpha: 0.05 }, undefined, 3)).toThrow(
      /2群のラボ/,
    );
  });
});
