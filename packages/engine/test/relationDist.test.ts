// つながりの図に使う分布（stats2-course #188 04）：ポアソン分布の確率と正規分布の密度。
// 図は「二項分布を変えると何になるか」を見せるので、ここが間違うと関係の主張（極限・近似）を図が逆に見せてしまう。
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { modelPmf, normalDensity, poissonPmf } from "../src";

describe("ポアソン分布の確率", () => {
  // 対象：poissonPmf の値。想定する故障：指数の符号・k! の取り違え（log の階乗の添字ずれ）。
  // 見つけ方：手で計算した値（e^−2・2e^−2・(4/3)e^−2）と比べる。式を写した期待値にしない（独立性）。
  it("Po(2) の 0・2・3 回は e^−2・2e^−2・(4/3)e^−2", () => {
    const f = poissonPmf(2, 3), e = Math.exp(-2);
    expect(f[0]).toBeCloseTo(e, 12); expect(f[2]).toBeCloseTo(2 * e, 12); expect(f[3]).toBeCloseTo((4 / 3) * e, 12);
  });
  // 対象：分布としての中身。想定する故障：k の範囲や λ の扱いの誤りで、合計・平均・分散が λ からずれる。
  // 見つけ方：十分大きく切った確率から、合計1・平均 λ・分散 λ を数で出す（手の値の確かめと違い、全部の k を見る）。
  it("性質：合計は1、平均と分散はどちらも λ", () => {
    fc.assert(fc.property(fc.double({ min: 0.05, max: 30, noNaN: true }), (lam) => {
      const f = poissonPmf(lam, Math.ceil(lam + 12 * Math.sqrt(lam) + 20));
      const sum = f.reduce((a, b) => a + b, 0), m = f.reduce((a, v, k) => a + k * v, 0);
      const v = f.reduce((a, p, k) => a + (k - m) ** 2 * p, 0);
      expect(sum).toBeCloseTo(1, 9); expect(m).toBeCloseTo(lam, 7); expect(v).toBeCloseTo(lam, 6);
    }));
  });
  // 対象：関係（二項 → ポアソン、極限）。想定する故障：図にした2つが近づかない（λ と n・p の取り違え）。
  // 見つけ方：np＝λ を保って n を大きくすると、2つの確率の差（全変動の距離）が単調に小さくなり、n＝1000 で 0.01 未満。
  it("np＝λ を保って n を大きくすると、二項分布との差が小さくなる", () => {
    const tv = (n: number) => { const b = modelPmf({ kind: "binom", n, p: 3 / n }), q = poissonPmf(3, n); return b.reduce((a, v, k) => a + Math.abs(v - q[k]!), 0) / 2; };
    const d = [10, 50, 200, 1000].map(tv);
    d.slice(1).forEach((x, i) => expect(x).toBeLessThan(d[i]!));
    expect(d[3]).toBeLessThan(0.01);
  });
  it("λ が負・kmax が整数でないと理由を言って止まる", () => {
    expect(() => poissonPmf(-1, 3)).toThrow(/λ/); expect(() => poissonPmf(1, 2.5)).toThrow(/kmax/);
    expect(poissonPmf(0, 2)).toEqual([1, 0, 0]);
  });
});

describe("正規分布の密度", () => {
  // 対象：normalDensity。想定する故障：σ と σ² の取り違え・2π の抜け（曲線の高さが棒と合わない）。
  // 見つけ方：数値で積分して1・平均・分散（σ²）が合うかを見る。σ² と σ を取り違えると分散がずれて落ちる。
  it("性質：面積は1、平均 μ・分散 σ²", () => {
    fc.assert(fc.property(fc.double({ min: -20, max: 20, noNaN: true }), fc.double({ min: 0.3, max: 8, noNaN: true }), (mu, sd) => {
      const h = sd / 200; let a = 0, m = 0, v = 0;
      for (let x = mu - 10 * sd; x <= mu + 10 * sd; x += h) { const d = normalDensity(x, mu, sd) * h; a += d; m += x * d; v += (x - mu) ** 2 * d; }
      expect(a).toBeCloseTo(1, 4); expect(m).toBeCloseTo(mu, 3); expect(v / (sd * sd)).toBeCloseTo(1, 3);
    }));
  });
  it("σ が0以下だと理由を言って止まる", () => { expect(() => normalDensity(0, 0, 0)).toThrow(/σ/); });
});
