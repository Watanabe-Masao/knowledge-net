// 確かめる対象：図を SVG の文字列で描く drawDist（stats2-course の issue 582 の D0。二項分布の棒）。
// 想定する故障：棒の高さが確率の比にならない（範囲の取り違え・kmin のずれ・最大で割らない）・強調する棒を取り違える・
//   page で色を変数にし忘れて暗い画面で読めない・file に変数が残って Notion の画像の色が消える・描けない設定を描いてしまう。
// 見つけ方：棒の高さの比を、テストの中で別に計算した二項確率（組合せを自分で数える）と比べる。色の付け方を2つの描き方で見る。
// 既存との違い：教材の figures.py の dist は Python で別に計算していた。ここは画面と教材の両方が使う1つの関数を確かめる。
// 検出の確かめ（2026-11-27）：棒の範囲を kmin から始めない形・page でも値の色にする形で、それぞれ落ちることを見た
import { describe, expect, it } from "vitest";
import { canDrawDist, drawDist } from "../src/draw";

const comb = (n: number, k: number) => {
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
};
const bars = (svg: string) =>
  [
    ...svg.matchAll(
      /<rect x="[\d.]+" y="[\d.]+" width="[\d.]+" height="([\d.]+)" rx="3"[^>]*(?:fill="([^"]+)"|style="fill:([^"]+)")/g,
    ),
  ].map((m) => ({ h: Number(m[1]), color: m[2] ?? m[3]! }));

describe("drawDist（二項分布の棒）", () => {
  it("棒の高さは確率の比（kmin・kmax の範囲）", () => {
    const n = 12,
      p = 0.35,
      kmin = 2,
      kmax = 9;
    const b = bars(drawDist({ family: "binom", n, p, kmin, kmax }));
    const pr = Array.from(
      { length: kmax - kmin + 1 },
      (_, i) => comb(n, kmin + i) * p ** (kmin + i) * (1 - p) ** (n - kmin - i),
    );
    expect(b).toHaveLength(pr.length);
    const top = Math.max(...pr);
    // 座標は小数1桁で書くので、最大の棒の高さ（約146）に対し 0.1 の丸めを許す
    b.forEach((x, i) => expect(Math.abs(x.h / Math.max(...b.map((y) => y.h)) - pr[i]! / top)).toBeLessThan(0.002));
  });
  it("強調する棒だけ強調の色。file は値、page は変数（値は予備）", () => {
    const file = bars(drawDist({ family: "binom", n: 4, p: 0.25, highlight: [1] }));
    expect(file.map((x) => x.color)).toEqual(["#9dbfe8", "#b86e00", "#9dbfe8", "#9dbfe8", "#9dbfe8"]);
    const page = drawDist({ family: "binom", n: 4, p: 0.25, highlight: [1] }, "page");
    expect(bars(page)[1]!.color).toBe("var(--data-hi, #b86e00)");
    expect(page).not.toMatch(/fill="#/);
    expect(drawDist({ family: "binom", n: 4, p: 0.25 })).not.toMatch(/var\(--/);
  });
  it("描ける設定だけを描く（重ねる分布・帯・境目は、まだ教材の Python で描く）", () => {
    expect(canDrawDist({ family: "binom", n: 4, p: 0.3 })).toBe(true);
    expect(canDrawDist({ family: "binom", n: 4, p: 0.3, overlay: { family: "normal" } })).toBe(false);
    expect(canDrawDist({ family: "poisson", lam: 2 })).toBe(false); // 上限のない分布は kmax が要る
    expect(canDrawDist({ family: "poisson", lam: 2, kmax: 6 })).toBe(true);
    expect(canDrawDist({ family: "normal", mu: 0, sigma: 1 })).toBe(false);
  });
});

// 確かめる対象：D1（stats2-course #577）で足した離散の分布。想定する故障：分布ごとの確率の取り違え（超幾何の当たりと全部の入れ違い・
// 幾何の始まりを0にする・負の二項の r の使い忘れ）・期待値の▲の値の取り違え。見つけ方：棒の高さの比と横軸の始まり・期待値の文字を、
// テストの中で別に数えた確率（組合せ・階乗を自分で数える）と比べる。検出の確かめ（2026-11-27）：幾何の始まりを0にすると落ちる
describe("drawDist（D1：離散の分布）", () => {
  const fact = (k: number) => (k <= 1 ? 1 : k * fact(k - 1));
  const cases: [string, Parameters<typeof drawDist>[0], [number, number][], string][] = [
    [
      "ベルヌーイ",
      { family: "bernoulli", p: 0.3 },
      [
        [0, 0.7],
        [1, 0.3],
      ],
      "期待値 0.3",
    ],
    [
      "ポアソン",
      { family: "poisson", lam: 2, kmax: 6 },
      Array.from({ length: 7 }, (_, k) => [k, (Math.exp(-2) * 2 ** k) / fact(k)] as [number, number]),
      "期待値 2",
    ],
    [
      "幾何（1回目の成功が k 回目）",
      { family: "geom", p: 0.3, kmax: 10 },
      Array.from({ length: 10 }, (_, i) => [i + 1, 0.7 ** i * 0.3] as [number, number]),
      "期待値 3.33",
    ],
    [
      "負の二項（3回目の成功が k 回目）",
      { family: "geom", p: 0.3, r: 3, kmax: 20 },
      Array.from({ length: 18 }, (_, i) => [i + 3, comb(i + 2, 2) * 0.3 ** 3 * 0.7 ** i] as [number, number]),
      "期待値 10",
    ],
    [
      "超幾何（20個中6個が当たり、5個取る）",
      { family: "hyper", N: 20, K: 6, n: 5 },
      Array.from({ length: 6 }, (_, k) => [k, (comb(6, k) * comb(14, 5 - k)) / comb(20, 5)] as [number, number]),
      "期待値 1.5",
    ],
  ];
  for (const [name, sp, pr, mean] of cases)
    it(name, () => {
      const svg = drawDist(sp);
      const b = bars(svg);
      expect(b).toHaveLength(pr.length);
      const top = Math.max(...pr.map((q) => q[1])),
        hmax = Math.max(...b.map((y) => y.h));
      b.forEach((x, i) => expect(Math.abs(x.h / hmax - pr[i]![1] / top)).toBeLessThan(0.002));
      expect(svg).toMatch(new RegExp(`>${pr[0]![0]}<`)); // 横軸の始まり
      expect(svg).toContain(mean);
    });
});
