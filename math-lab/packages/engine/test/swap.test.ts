// 実験の結果が理論と逆の大小に出る頻度（stats2-course #379）。画面がその場で書く「N セットなら約 x%」の元。
import { describe, expect, it } from "vitest";
import { binomMu4, createRandom, normalCdf, probLargest, sampleVarianceSd } from "../src";

describe("大小が入れ替わる頻度", () => {
  // 確かめる対象：probLargest の数値積分。
  // 想定する故障：積分の重み・範囲・刻みの誤りで、確率が数ポイントずれる（画面の「約 x%」が誤る）。
  // 見つけ方：2つの正規のときの閉じた式 Φ((m_i − m_j)/√(s_i²＋s_j²)) と、ばらつきの比・差の大きさを変えて照らす。
  // 既存との違い：normalCdf の近似は lab.test.ts で確かめている。ここは積分の組み立てだけ。
  // 検出の確かめ（2026-11-13）：Simpson の重みを 4・2 から 2・2 にすると落ちることを見た
  it("2つなら閉じた式と一致する", () => {
    for (const [m1, s1, m2, s2] of [
      [0, 1, 0, 1],
      [2.5, 0.1, 2.1, 0.09],
      [1, 0.3, 0, 2],
      [0, 0.05, 0.4, 0.5],
    ] as const) {
      const exact = normalCdf((m1 - m2) / Math.hypot(s1, s2));
      expect(probLargest([m1, m2], [s1, s2], 0)).toBeCloseTo(exact, 6);
    }
  });

  // 確かめる対象：binomMu4・sampleVarianceSd・probLargest を組んだ「実測の分散でいちばん大きい p が理論と違う」頻度
  //   （二項分布 D-02 の観察が書く数）。
  // 想定する故障：μ4 の式・標本分散の標準偏差の式（1/M の付け忘れ・σ⁴ の係数）の誤りで頻度が大きくずれる。
  // 見つけ方：種つきの乱数で D-02 と同じ形（n＝10・p＝10〜90%）を M＝200 セットずつ 3000 回くり返し、
  //   理論の最大（p＝50%）以外が最大になった割合と比べる（許す幅は標準誤差の5倍。math-lab の決まり 3）。
  // 既存との違い：上のテストは積分だけ。これは式の組み合わせを独立な実験（乱数）で照らす。
  // 検出の確かめ（2026-11-13）：sampleVarianceSd の /M を外すと落ちることを見た
  it("二項分布の分散の最大が入れ替わる頻度は、実験と標準誤差の5倍の中で合う", () => {
    const n = 10,
      ps = [0.1, 0.3, 0.5, 0.7, 0.9],
      M = 200,
      R = 3000;
    const means = ps.map((p) => n * p * (1 - p)),
      sds = ps.map((p) => sampleVarianceSd(n * p * (1 - p), binomMu4(n, p), M));
    const theory = 1 - probLargest(means, sds, 2);
    const rng = createRandom(379);
    let miss = 0;
    for (let r = 0; r < R; r++) {
      const v = ps.map((p) => {
        let s = 0,
          s2 = 0;
        for (let j = 0; j < M; j++) {
          let k = 0;
          for (let t = 0; t < n; t++) k += rng.chance(p) ? 1 : 0;
          s += k;
          s2 += k * k;
        }
        return (s2 - (s * s) / M) / (M - 1);
      });
      if (v.indexOf(Math.max(...v)) !== 2) miss++;
    }
    const se = Math.sqrt((theory * (1 - theory)) / R);
    expect(theory).toBeGreaterThan(0.1); // M＝200 では入れ替わりが目に見える頻度で起きる（検出に使える大きさ）
    expect(Math.abs(miss / R - theory)).toBeLessThan(5 * se);
  });
});
