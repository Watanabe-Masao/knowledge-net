// z 検定・検出力（モード ztest・power。教材の検定ラボの z・power。stats2-course #48 の U24）。
// 確かめる対象：z と p 値（両側・片側）、数表の境目、検出力と β。
// 想定する故障：両側の p 値を2倍し忘れる・片側の境目に両側の値を使う・検出力で反対側の裾を落とす／足しすぎる・標準誤差に √n を掛け忘れる。
// 見つけ方：手で出した値（σ＝12・n＝36・x̄＝104.2：SE 2、z 2.1、両側 p＝2×(1−Φ(2.1))＝0.0357。
//   μ₁＝103.6：ずれ 1.8、両側5%の検出力 1−Φ(0.16)＋Φ(−3.76)≒0.4365。μ₁＝μ₀ なら検出力は有意水準と同じ 0.05）。
//   Φ の値は math.erf で別に出した（engine の normalCdf とは別の出どころ）。
// 既存との違い：ほかの場面は推定。ここは検定の判断。知らない有意水準で黙って描かないことも見る。
// 検出の確かめ（2026-11-16）：両側の p 値の2倍をやめると1つ目が落ちることを見た
import { describe, expect, it } from "vitest";
import { drawScene } from "../src";

const val = (d: ReturnType<typeof drawScene>, k: string) => d!.stats.find((s) => s.key === k)!.value;

describe("検定の場面", () => {
  it("ztest：σ＝12・n＝36・x̄＝104.2 で z 2.1、両側の p 値 0.036、5%なら棄却・1%なら棄却しない", () => {
    const st = { side: "two", alpha: "0.05", xbar: 104.2, mu0: 100, sigma: 12, n: 36 };
    const d = drawScene("ztest", st, undefined, 3);
    expect([val(d, "se"), val(d, "z"), val(d, "p"), val(d, "decision")]).toEqual(["2", "2.1", "0.036", "棄却する"]);
    expect(val(drawScene("ztest", { ...st, alpha: 0.01 }, undefined, 3), "decision")).toBe("棄却しない");
    expect(val(drawScene("ztest", { ...st, side: "upper" }, undefined, 3), "crit")).toBe("1.645");
  });
  it("power：ずれ1.8で検出力 0.437、μ₁＝μ₀ なら有意水準と同じ 0.05", () => {
    const st = { side: "two", alpha: "0.05", mu0: 100, mu1: 103.6, sigma: 12, n: 36 };
    expect([
      val(drawScene("power", st, undefined, 3), "power"),
      val(drawScene("power", st, undefined, 3), "beta"),
    ]).toEqual(["0.437", "0.563"]);
    expect(val(drawScene("power", { ...st, mu1: 100 }, undefined, 3), "power")).toBe("0.05");
  });
  it("数表にない有意水準は止める", () => {
    expect(() =>
      drawScene("ztest", { side: "two", alpha: 0.2, xbar: 1, mu0: 0, sigma: 1, n: 1 }, undefined, 3),
    ).toThrow(/0.05/);
  });
});
