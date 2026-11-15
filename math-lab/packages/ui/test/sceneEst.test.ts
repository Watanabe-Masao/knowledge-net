// 推定量を比べる・分散の推定量（モード comp・var。教材の推定ラボ。stats2-course #47 の U21）。
// 確かめる対象：不偏と一致の比べに使う理論の値（標本平均・最初の1個・X̄＋b の偏りと標準誤差、s² と v の偏りと MSE）。
// 想定する故障：最初の1個の標準誤差を σ÷√n にする（一致しない推定量が一致して見える）・v の偏りの符号や n の取り違え・MSE に偏り² を足し忘れる。
// 見つけ方：手で出した値（σ＝10・n＝25：X̄ の SE 2、X₁ は 10、X̄＋2 の MSE 4＋4＝8。σ²＝4・n＝5：v の偏り −0.8、MSE s² 8、v 0.32×4＝… を下で式から）。
// 既存との違い：ほかのモードは分布の形。ここは推定量の性質の数。名前 var の取り違え（検定ラボの var）も止まることを見る。
// 検出の確かめ（2026-11-16）：最初の1個の SE を σ÷√n にすると落ちることを見た
import { describe, expect, it } from "vitest";
import { drawScene } from "../src";

const val = (d: ReturnType<typeof drawScene>, k: string) => d!.stats.find((s) => s.key === k)!.value;

describe("推定量の場面", () => {
  it("comp：n＝25 で X̄ の SE は 2、X₁ は 10 のまま、X̄＋2 の MSE は 8", () => {
    const d = drawScene("comp", { sigma: 10, n: 25, b: 2 }, undefined, 3);
    expect([val(d, "seMean"), val(d, "seFirst"), val(d, "mseShift")]).toEqual(["2", "10", "8"]);
  });
  it("var：σ²＝4・n＝5 で v の偏り −0.8、s² の MSE 8、v の MSE 2·4·16/25＋0.64＝5.76", () => {
    const d = drawScene("var", { sigma2: 4, n: 5 }, undefined, 3);
    expect([val(d, "biasV"), val(d, "mseS2"), val(d, "mseV")]).toEqual(["-0.8", "8", "5.76"]);
  });
  it("var：検定ラボの var の状態（v0）は止める", () => {
    expect(() => drawScene("var", { n: 10, s2: 3, v0: 2 }, undefined, 3)).toThrow(/推定ラボ/);
  });
});
