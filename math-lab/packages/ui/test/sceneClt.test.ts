// 中心極限定理（場面のモード clt。教材の中心極限定理ラボの clt。stats2-course #47 の U19）。
// 確かめる対象：待ち時間（指数分布・平均5分）から n 人分の平均 X̄ の正確な密度（形 n のガンマ分布）と、4〜6分に入る確率・標準偏差・歪度。
// 想定する故障：ガンマの密度の尺度の取り違え（率 n/μ と 1/μ・形 n と n−1）で、曲線が n で細くならない・面積が1にならない。
//   確率の数値積分の刻みの誤り。σ÷√n の √ の落とし。
// 見つけ方：確率は、密度の積分とは別の道（アーランの分布関数の閉じた式 1−Σ e^{−λ}λᵏ/k!、λ＝n·x/μ）で計算した値と比べる。
//   n＝1 は指数分布の e^{−4/5}−e^{−6/5}。面積が1になること（0〜60分の積分）。
// 既存との違い：ほかのモードの密度は正規・一様・指数。ここは標本平均の分布（n で形が変わる）。
// 検出の確かめ（2026-11-16）：密度の率を 1/μ にすると、n＝30 の確率と面積で落ちることを見た
import { describe, expect, it } from "vitest";
import { drawScene } from "../src";
import { xbarExpoDensity, xbarExpoProb } from "../src/SceneModes2";

const erlangCdf = (x: number, n: number, mu = 5) => {
  const lam = (n * x) / mu;
  let term = Math.exp(-lam),
    sum = term;
  for (let k = 1; k < n; k++) {
    term *= lam / k;
    sum += term;
  }
  return 1 - sum;
};
const val = (d: ReturnType<typeof drawScene>, k: string) => d!.stats.find((s) => s.key === k)!.value;

describe("中心極限定理（clt）", () => {
  it.each([1, 5, 30, 100])("n＝%i：4〜6分の確率がアーランの分布関数と合い、面積がほぼ1", (n) => {
    expect(xbarExpoProb(4, 6, n)).toBeCloseTo(erlangCdf(6, n) - erlangCdf(4, n), 6);
    expect(xbarExpoProb(0, 60, n)).toBeCloseTo(erlangCdf(60, n), 6); // 面積（60分より先は n＝1 でも e^{−12} だけ）
  });
  it("n＝1 は指数分布そのもの", () => {
    expect(xbarExpoDensity(2, 1)).toBeCloseTo(Math.exp(-2 / 5) / 5, 12);
  });
  it("表示：n＝30 で標準偏差 0.91分・歪度 0.37、正規分布の曲線を重ねる", () => {
    const d = drawScene("clt", { shape: "expo", n: 30 }, undefined, 2)!;
    expect([val(d, "se"), val(d, "skew")]).toEqual(["0.91分", "0.37"]);
    expect(d.view.kind === "density" && typeof d.view.g).toBe("function");
    expect(d.view.kind === "density" && d.view.legend).toEqual(["30人分の平均", "正規分布"]); // 線の名前（原則 7）
  });
  // 正確な密度を描けるのは待ち時間（expo）だけ。ほかの形の版が来たら、黙って待ち時間を描かずに止める
  it("expo 以外の形は止める", () => {
    expect(() => drawScene("clt", { shape: "unif", n: 5 }, undefined, 2)).toThrow(/expo/);
  });
});
