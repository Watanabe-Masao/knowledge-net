// つながりの図に使う分布（stats2-course #188 04）：ポアソン分布の確率と正規分布の密度。
// 図は「二項分布を変えると何になるか」を見せるので、ここが間違うと関係の主張（極限・近似）を図が逆に見せてしまう。
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { modelPmf, negbinomPmf, normalCdf, normalDensity, normalQuantile, poissonPmf } from "../src";

describe("ポアソン分布の確率", () => {
  // 対象：poissonPmf の値。想定する故障：指数の符号・k! の取り違え（log の階乗の添字ずれ）。
  // 見つけ方：手で計算した値（e^−2・2e^−2・(4/3)e^−2）と比べる。式を写した期待値にしない（独立性）。
  it("Po(2) の 0・2・3 回は e^−2・2e^−2・(4/3)e^−2", () => {
    const f = poissonPmf(2, 3),
      e = Math.exp(-2);
    expect(f[0]).toBeCloseTo(e, 12);
    expect(f[2]).toBeCloseTo(2 * e, 12);
    expect(f[3]).toBeCloseTo((4 / 3) * e, 12);
  });
  // 対象：分布としての中身。想定する故障：k の範囲や λ の扱いの誤りで、合計・平均・分散が λ からずれる。
  // 見つけ方：十分大きく切った確率から、合計1・平均 λ・分散 λ を数で出す（手の値の確かめと違い、全部の k を見る）。
  it("性質：合計は1、平均と分散はどちらも λ", () => {
    fc.assert(
      fc.property(fc.double({ min: 0.05, max: 30, noNaN: true }), (lam) => {
        const f = poissonPmf(lam, Math.ceil(lam + 12 * Math.sqrt(lam) + 20));
        const sum = f.reduce((a, b) => a + b, 0),
          m = f.reduce((a, v, k) => a + k * v, 0);
        const v = f.reduce((a, p, k) => a + (k - m) ** 2 * p, 0);
        expect(sum).toBeCloseTo(1, 9);
        expect(m).toBeCloseTo(lam, 7);
        expect(v).toBeCloseTo(lam, 6);
      }),
    );
  });
  // 対象：関係（二項 → ポアソン、極限）。想定する故障：図にした2つが近づかない（λ と n・p の取り違え）。
  // 見つけ方：np＝λ を保って n を大きくすると、2つの確率の差（全変動の距離）が単調に小さくなり、n＝1000 で 0.01 未満。
  it("np＝λ を保って n を大きくすると、二項分布との差が小さくなる", () => {
    const tv = (n: number) => {
      const b = modelPmf({ kind: "binom", n, p: 3 / n }),
        q = poissonPmf(3, n);
      return b.reduce((a, v, k) => a + Math.abs(v - q[k]!), 0) / 2;
    };
    const d = [10, 50, 200, 1000].map(tv);
    d.slice(1).forEach((x, i) => expect(x).toBeLessThan(d[i]!));
    expect(d[3]).toBeLessThan(0.01);
  });
  it("λ が負・kmax が整数でないと理由を言って止まる", () => {
    expect(() => poissonPmf(-1, 3)).toThrow(/λ/);
    expect(() => poissonPmf(1, 2.5)).toThrow(/kmax/);
    expect(poissonPmf(0, 2)).toEqual([1, 0, 0]);
  });
});

describe("正規分布の密度", () => {
  // 対象：normalDensity。想定する故障：σ と σ² の取り違え・2π の抜け（曲線の高さが棒と合わない）。
  // 見つけ方：数値で積分して1・平均・分散（σ²）が合うかを見る。σ² と σ を取り違えると分散がずれて落ちる。
  it("性質：面積は1、平均 μ・分散 σ²", () => {
    fc.assert(
      fc.property(
        fc.double({ min: -20, max: 20, noNaN: true }),
        fc.double({ min: 0.3, max: 8, noNaN: true }),
        (mu, sd) => {
          const h = sd / 200;
          let a = 0,
            m = 0,
            v = 0;
          for (let x = mu - 10 * sd; x <= mu + 10 * sd; x += h) {
            const d = normalDensity(x, mu, sd) * h;
            a += d;
            m += x * d;
            v += (x - mu) ** 2 * d;
          }
          expect(a).toBeCloseTo(1, 4);
          expect(m).toBeCloseTo(mu, 3);
          expect(v / (sd * sd)).toBeCloseTo(1, 3);
        },
      ),
    );
  });
  it("σ が0以下だと理由を言って止まる", () => {
    expect(() => normalDensity(0, 0, 0)).toThrow(/σ/);
  });
});

describe("r 回目の成功までの回数（幾何・負の二項）", () => {
  // 対象：negbinomPmf。想定する故障：C(k−1, r−1) を C(k, r) にする・k＜r に確率を残す・(1−p) の指数のずれ。
  // 見つけ方：手の値（幾何 p＝0.3 の 1・2・3 回目：0.3・0.21・0.147、r＝2 の 2・3 回目：0.09・0.126）と、
  // 性質（合計1・平均 r/p・分散 r(1−p)/p²）。手の値は k の数え方（試行の番号か、失敗の数か）の取り違えも見つける。
  it("手の値", () => {
    const g = negbinomPmf(1, 0.3, 3),
      h = negbinomPmf(2, 0.3, 3);
    expect(g[0]).toBe(0);
    expect(g[1]).toBeCloseTo(0.3, 12);
    expect(g[2]).toBeCloseTo(0.21, 12);
    expect(g[3]).toBeCloseTo(0.147, 12);
    expect(h[1]).toBe(0);
    expect(h[2]).toBeCloseTo(0.09, 12);
    expect(h[3]).toBeCloseTo(0.126, 12);
  });
  it("性質：合計1・平均 r/p・分散 r(1−p)/p²", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 5 }), fc.double({ min: 0.1, max: 0.95, noNaN: true }), (r, p) => {
        const kmax = Math.ceil(r / p + (40 * Math.sqrt(r * (1 - p))) / p + 20);
        const f = negbinomPmf(r, p, kmax);
        const sum = f.reduce((a, b) => a + b, 0),
          m = f.reduce((a, v, k) => a + k * v, 0),
          v = f.reduce((a, q, k) => a + (k - m) ** 2 * q, 0);
        expect(sum).toBeCloseTo(1, 8);
        expect(m).toBeCloseTo(r / p, 6);
        expect(v / ((r * (1 - p)) / p ** 2)).toBeCloseTo(1, 5);
      }),
    );
  });
});

describe("標準正規分布の累積と逆関数", () => {
  // 対象：normalCdf・normalQuantile（連続の分布の面積と上位 p% の値）。想定する故障：√2 の抜け（Φ(1) が 0.92 になる）・負の側の対称の誤り・逆関数の枝の取り違え。
  // 見つけ方：表の値（Φ(1)＝0.841345、Φ(1.96)＝0.975002、Φ(−1.645)＝0.049985）と、Φ⁻¹(Φ(z))＝z（3つの枝をまたぐ z）。
  it("表の値", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 7);
    expect(normalCdf(1)).toBeCloseTo(0.841345, 6);
    expect(normalCdf(1.96)).toBeCloseTo(0.975002, 6);
    expect(normalCdf(-1.645)).toBeCloseTo(0.049985, 6);
    expect(normalQuantile(0.975)).toBeCloseTo(1.959964, 5);
    expect(normalQuantile(0.05)).toBeCloseTo(-1.644854, 5);
  });
  it("性質：Φ⁻¹(Φ(z))＝z（−3.5〜3.5。Φ の近似の誤差 1.5×10⁻⁷ が裾で密度に割られて大きくなるので 0.0005 まで）", () => {
    fc.assert(
      fc.property(fc.double({ min: -3.5, max: 3.5, noNaN: true }), (z) => {
        expect(normalQuantile(normalCdf(z))).toBeCloseTo(z, 3);
      }),
    );
  });
  it("q が 0〜1 の外だと理由を言って止まる", () => {
    expect(() => normalQuantile(1)).toThrow(/q/);
  });
});
