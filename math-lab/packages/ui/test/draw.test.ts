// 確かめる対象：図を SVG の文字列で描く drawDist（stats2-course の issue 582 の D0。二項分布の棒）。
// 想定する故障：棒の高さが確率の比にならない（範囲の取り違え・kmin のずれ・最大で割らない）・強調する棒を取り違える・
//   page で色を変数にし忘れて暗い画面で読めない・file に変数が残って Notion の画像の色が消える・描けない設定を描いてしまう。
// 見つけ方：棒の高さの比を、テストの中で別に計算した二項確率（組合せを自分で数える）と比べる。色の付け方を2つの描き方で見る。
// 既存との違い：教材の figures.py の dist は Python で別に計算していた。ここは画面と教材の両方が使う1つの関数を確かめる。
// 検出の確かめ（2026-11-27）：棒の範囲を kmin から始めない形・page でも値の色にする形で、それぞれ落ちることを見た
import { describe, expect, it } from "vitest";
import { canDrawDist, drawData, drawDist, five } from "../src/draw";

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

// 確かめる対象：D2（stats2-course #577）の連続の分布の曲線 drawCurve（drawDist から呼ぶ）。
// 想定する故障：密度の式の取り違え（t の自由度・F の分子と分母・指数の λ と 1/λ）・横軸の写し方のずれ・平均の▲の値の取り違え・
//   描けない設定（帯・正規でない重ね）を描いてしまう。
// 見つけ方：曲線の点の高さの比を、テストの中で別に書いた密度（コーシー＝t(1)、e^{−x/2}/2＝χ²(2)、1/(1+x)²＝F(2, 2) など
//   閉じた形の式）と比べ、横軸の位置から x を逆に求める。検出の確かめ（2026-11-27）：F の d1・d2 を入れ違えると落ちる
describe("drawDist（D2：連続の分布の曲線）", () => {
  const curve = (svg: string) => {
    const m = svg.match(/<path d="M([^"]+)" fill="none"[^>]*stroke-width="2.2"/)!;
    return m[1]!.split(" L").map((p) => p.split(",").map(Number) as [number, number]);
  };
  const cases: [string, Parameters<typeof drawDist>[0], (x: number) => number, string | null][] = [
    [
      "正規",
      { family: "normal", mu: 100, sigma: 10, ticks: [70, 130, 10] },
      (x) => Math.exp(-(((x - 100) / 10) ** 2) / 2),
      "平均 100",
    ],
    ["一様", { family: "uniform", a: 2, b: 6, ticks: [0, 8, 2] }, (x) => (x >= 2 && x <= 6 ? 1 : 0), "平均 4"],
    ["指数", { family: "expo", lam: 0.5, ticks: [0, 10, 2] }, (x) => Math.exp(-0.5 * x), "平均 2"],
    ["t(1)（コーシー）", { family: "t", df: 1, ticks: [-4, 4, 2] }, (x) => 1 / (1 + x * x), null],
    ["χ²(2)", { family: "chi2", df: 2, ticks: [0, 10, 2] }, (x) => Math.exp(-x / 2), "平均 2"],
    ["F(2, 3)", { family: "f", d1: 2, d2: 3, ticks: [0, 6, 2] }, (x) => (1 + (2 * x) / 3) ** -2.5, "平均 3"],
  ];
  for (const [name, sp, dens, mean] of cases)
    it(name, () => {
      const svg = drawDist(sp);
      const pts = curve(svg);
      const [lo, hi] = (sp as { ticks: number[] }).ticks as [number, number];
      const base = Number(svg.match(/<line x1="20" y1="([\d.]+)" x2="340"/)![1]); // 横軸の線
      const xs = pts.map(([px]) => lo + ((px - 20) / 320) * (hi - lo));
      const want = xs.map(dens),
        wmax = Math.max(...want);
      const got = pts.map(([, py]) => base - py),
        gmax = Math.max(...got);
      // 座標は小数1桁なので、高さ約150に対し 0.1 の丸めを許す。一様の段の縁は x の丸めで両側に分かれるので外す
      got.forEach((h, i) => {
        if (name === "一様" && Math.abs(xs[i]! - 2) < 0.05) return;
        if (name === "一様" && Math.abs(xs[i]! - 6) < 0.05) return;
        expect(Math.abs(h / gmax - want[i]! / wmax), `${name} x=${xs[i]!.toFixed(2)}`).toBeLessThan(0.003);
      });
      if (mean) expect(svg).toContain(mean);
      else expect(svg).not.toContain("平均"); // t(1) は平均がない
    });
  it("塗る範囲・点線の目印・重ねる正規分布を描き、描けない設定は断る", () => {
    const svg = drawDist({
      family: "t",
      df: 4,
      ticks: [-4, 4, 2],
      mark_mean: false,
      shade: [{ outside: [-2.776, 2.776], label: "両側 5%" }],
      marks: [{ x: 2.776, label: "t(4) 2.776" }],
      overlay: { family: "normal", mu: 0, sigma: 1, label: "標準正規分布" },
      label: "t(4)",
    });
    expect(svg.match(/fill-opacity="0.55"/g)).toHaveLength(2); // 両裾
    expect(svg).toContain("t(4) 2.776");
    expect(svg).toContain('stroke-dasharray="4 3"/>'); // 重ねる曲線
    expect(svg).toContain("標準正規分布");
    expect(canDrawDist({ family: "normal", mu: 0, sigma: 1 })).toBe(false); // ticks がない
    expect(canDrawDist({ family: "normal", mu: 0, sigma: 1, ticks: [-3, 3, 1], band: 2 })).toBe(false);
    expect(canDrawDist({ family: "t", df: 4, ticks: [-4, 4, 2], overlay: { family: "t", df: 9 } })).toBe(false);
    expect(canDrawDist({ family: "xbar_expo", mu: 5, n: 5, ticks: [0, 25, 5] })).toBe(false);
  });
});

// 確かめる対象：D3a（stats2-course #577）のデータの図。想定する故障：四分位数の求め方が教材と違う（中央値を半分に入れる・入れない）・
//   柵の外の判定のずれ・ヒストグラムの階級の端（下限を含み上限を含まない）の取り違え・最頻値が2つのときに1本しか引かない。
// 見つけ方：教材の問題の答え（U06-011 の Q₁＝2・Q₃＝4・外れ値17、U06-031 の 12〜19 分・95分）と同じ数になるかを見る。
//   ヒストグラムは棒の高さの比を、テストの中で数えた度数と比べる。検出の確かめ（2026-11-27）：five の上半分を s.slice(h) にすると落ちる
describe("drawData（D3a：データの図）", () => {
  it("四分位数と柵は教材の答えと同じ", () => {
    const a = five([1, 1, 2, 2, 2, 3, 3, 4, 5, 17]);
    expect([a.q1, a.q2, a.q3, a.iqr, a.out]).toEqual([2, 2.5, 4, 2, [17]]);
    const b = five([10, 12, 12, 15, 15, 15, 18, 20, 95]);
    expect([b.q1, b.q2, b.q3, b.out, b.whi]).toEqual([12, 15, 19, [95], 20]);
    expect(
      drawData({ type: "boxplot", rows: [{ data: [10, 12, 12, 15, 15, 15, 18, 20, 95] }], fence: true, step: 10 }),
    ).toContain("外れ値候補：95");
  });
  it("ヒストグラムの棒は度数の比（階級は下限を含み上限を含まない）", () => {
    const data = [12, 15, 18, 19, 20, 21, 22, 29, 30, 30, 31, 55];
    const svg = drawData({ type: "hist", data, start: 10, width: 10 });
    const hs = [...svg.matchAll(/<rect x="[\d.]+" y="[\d.]+" width="[\d.]+" height="([\d.]+)" rx="0"/g)].map((m) =>
      Number(m[1]),
    );
    const want = [4, 4, 3, 0, 1]; // 10〜20：12,15,18,19／20〜30：20,21,22,29／30〜40：30,30,31／40〜50：なし／50〜60：55
    expect(hs).toHaveLength(5);
    hs.forEach((h, i) => expect(Math.abs(h / Math.max(...hs) - want[i]! / 4)).toBeLessThan(0.002));
  });
  it("代表値の位置：最頻値が2つなら2本、凡例に数", () => {
    const svg = drawData({ type: "centers", data: [1, 2, 2, 3, 4, 4, 9], ticks: [0, 5, 10] });
    expect(svg).toContain("平均 3.57");
    expect(svg).toContain("中央値 3");
    expect(svg.match(/最頻値 [24]</g)).toHaveLength(2);
  });
});

// 確かめる対象：代表値の位置の、凡例と横軸の名前の重なり（2026-11-27 に暗い画面の見本で、横軸の名前が最後の凡例に重なっていた。
// 教材の FIG-U06-concept も同じ）。見つけ方：横軸の名前の字の下（y）が、最後の凡例の字の下より 12 以上下にあるか
it("代表値の位置：横軸の名前が凡例に重ならない", () => {
  const svg = drawData({ type: "centers", data: [10, 10, 10, 30], lo: 0, hi: 40, axis_label: "売上（万円）" });
  const ys = [...svg.matchAll(/<text x="[\d.]+" y="([\d.]+)"[^>]*>([^<]+)<\/text>/g)].map(
    (m) => [Number(m[1]), m[2]] as const,
  );
  const legend = Math.max(...ys.filter(([, t]) => /^(平均|中央値|最頻値) /.test(t)).map(([y]) => y));
  const label = ys.find(([, t]) => t === "売上（万円）")![0];
  expect(label - legend).toBeGreaterThanOrEqual(12);
});
