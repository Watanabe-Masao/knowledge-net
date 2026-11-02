// 応用の課題の答え（solveApply。stats2-course #171）。
// 確かめる対象：原本の10の課題の答えが正しいこと・「最小の n」「最大の強さ」が本当に境目であること・条件の外で止まること。
// 想定する故障：境目の1つずれ（< と ≦・切り上げ忘れ）、以上と「より多い」の取り違え、二項分布の分散の取り違え、浮動小数の誤差で境目を飛ばす。
// 見つけ方：期待値は modelPmf・mechanismMoments を使わず、組合せの式と分散の閉じた式から手で計算した値と照らす（独立性）。境目は前後の値で確かめる。
// 既存のテストとの違い：mechanism.test.ts は起き方の分布、ここは課題ごとの答えの求め方（逆算・最小・最大）。
import { describe, expect, it } from "vitest";
import { solveApply } from "../src";

const comb = (n: number, k: number) => { let c = 1; for (let i = 1; i <= k; i++) c = (c * (n - k + i)) / i; return c; };
const pmf = (n: number, p: number, k: number) => comb(n, k) * p ** k * (1 - p) ** (n - k);
const close = (a: number, b: number, tol = 1e-9) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol * Math.max(1, Math.abs(b)));

describe("原本の10の課題（手計算の値と照らす）", () => {
  it("A-01 逆算：20回で平均6回 → p＝0.3", () => close(solveApply({ method: "mean-to-p", n: 20, mean: 6 }).answer, 0.3));
  it("A-02 設計：p＝0.3 で割合の標準偏差を 0.08 以下 → n＝33（32 では超える）", () => {
    const r = solveApply({ method: "min-n-share-sd", p: 0.3, sd: 0.08 });
    expect(r.answer).toBe(33);
    expect(Math.sqrt(0.21 / 32)).toBeGreaterThan(0.08);
  });
  it("B-01 反証：10回中3回は 30回中9回より約1.7倍起きやすい（answer 0）", () => {
    const r = solveApply({ method: "compare-eq", a: { n: 10, p: 0.3, k: 3 }, b: { n: 30, p: 0.3, k: 9 } });
    close(r.facts.a!, 120 * 0.3 ** 3 * 0.7 ** 7);
    close(r.facts.b!, pmf(30, 0.3, 9));
    expect(r.answer).toBe(0);
  });
  it("B-02 評価：3回以上と3回より多いの差は P(X＝3)", () => close(solveApply({ method: "boundary", n: 10, p: 0.3, k: 3 }).answer, 120 * 0.027 * 0.7 ** 7));
  it("B-04 評価：10回中10回（p＝0.5）は1000人なら 1000÷1024 人", () => close(solveApply({ method: "expected-observers", n: 10, p: 0.5, event: { op: "ge", k: 10 }, people: 1000 }).answer, 1000 / 1024));
  it("C-02 設計：10回中4回以上（p＝0.3）のずれを ±1% 以内 → N＝9105", () => {
    const P = 1 - [0, 1, 2, 3].reduce((s, k) => s + pmf(10, 0.3, k), 0);
    const N = Math.ceil((4 * P * (1 - P)) / 0.0001);
    expect(solveApply({ method: "sets-for-error", n: 10, p: 0.3, event: { op: "ge", k: 4 }, err: 0.01 }).answer).toBe(N);
    expect(N).toBe(9105);
  });
  it("E-01 反証：疲れて下がると、平均は np でも二項分布と言えない（分散が小さい）", () => {
    const r = solveApply({ method: "binom-judge", mechanism: { kind: "fatigue", n: 10, p: 0.5, drop: 0.3 } });
    expect(r.answer).toBe(1);
    close(r.facts.mean!, 5);
    expect(r.facts.ratio!).toBeLessThan(1);
    expect(solveApply({ method: "binom-judge", mechanism: { kind: "bernoulli", n: 10, p: 0.5 } }).answer).toBe(0);
  });
  it("E-02 評価：分散が1.1倍以内に収まる引きずる強さは 0.05 まで（0.06 で超える）", () => {
    const ratio = (c: number) => 1 + (2 / 10) * Array.from({ length: 9 }, (_, i) => (10 - (i + 1)) * c ** (i + 1)).reduce((a, b) => a + b, 0);
    expect(ratio(0.05)).toBeLessThanOrEqual(1.1);
    expect(ratio(0.06)).toBeGreaterThan(1.1);
    close(solveApply({ method: "max-strength", mechanism: { kind: "streak", n: 10, p: 0.5, carry: 0 }, param: "carry", min: 0, max: 0.6, step: 0.01, ratio: 1.1 }).answer, 0.05);
  });
  it("E-03 変換：10個取って分散が二項分布の0.8倍以上 → 箱は46個（45個では足りない）。0.9倍なら91個", () => {
    expect(solveApply({ method: "min-total", n: 10, ratio: 0.8 }).answer).toBe(46);
    expect((45 - 10) / (45 - 1)).toBeLessThan(0.8);
    expect(solveApply({ method: "min-total", n: 10, ratio: 0.9 }).answer).toBe(91);
  });
  it("E-04 逆算：n＝10・p＝0.5 で分散 3.4 → d＝0.1（2.5＋90d²＝3.4）", () => close(solveApply({ method: "solve-spread", n: 10, p: 0.5, variance: 3.4 }).answer, 0.1));
});

describe("解き方の段（答えのあとに出す）", () => {
  // 確かめる対象：境目の前後を言う段が、1つ手前と答えの両方の値を、区別できる桁で言うこと（「±1%、±1%」のように同じに見えると、なぜその数かが伝わらない）
  it("最小の数を求める課題は、1つ手前と答えの値を別の値として言う", () => {
    const last = (r: ReturnType<typeof solveApply>) => r.steps[r.steps.length - 1]!.text ?? "";
    const a = last(solveApply({ method: "min-n-share-sd", p: 0.3, sd: 0.08 }));
    expect(a).toContain("32 回では 0.08101");
    expect(a).toContain("33 回で 0.07977");
    const c = last(solveApply({ method: "sets-for-error", n: 10, p: 0.3, event: { op: "ge", k: 4 }, err: 0.01 }));
    const [x, y] = [...c.matchAll(/±([\d.]+)%/g)].map((m) => Number(m[1]));
    expect(x).toBeGreaterThan(1);
    expect(y).toBeLessThanOrEqual(1);
    expect(last(solveApply({ method: "min-total", n: 10, ratio: 0.8 }))).toMatch(/45 個では 0\.795 倍、46 個で 0\.8 倍/);
  });
});

describe("境目と止まる条件", () => {
  it("最小の n・N は、1つ手前では条件を満たさない（いろいろな p と sd）", () => {
    for (const p of [0.01, 0.1, 0.3, 0.5, 0.9]) for (const sd of [0.2, 0.05, 0.013]) {
      const n = solveApply({ method: "min-n-share-sd", p, sd }).answer;
      expect(Math.sqrt((p * (1 - p)) / n)).toBeLessThanOrEqual(sd + 1e-12);
      if (n > 1) expect(Math.sqrt((p * (1 - p)) / (n - 1))).toBeGreaterThan(sd);
    }
  });
  it("最大の強さは、分散が小さくなる起き方でも ratio 分の1 の下限で止まる（疲れて下がる：1−(330/81)d²÷2.5≧1/1.1 → d＝0.23）", () => {
    const ratio = (d: number) => 1 - ((330 / 81) * d * d) / 2.5;
    expect(ratio(0.23)).toBeGreaterThanOrEqual(1 / 1.1);
    expect(ratio(0.24)).toBeLessThan(1 / 1.1);
    close(solveApply({ method: "max-strength", mechanism: { kind: "fatigue", n: 10, p: 0.5, drop: 0 }, param: "drop", min: 0, max: 0.5, step: 0.01, ratio: 1.1 }).answer, 0.23);
  });
  it("条件の外では理由を言って止まる", () => {
    expect(() => solveApply({ method: "mean-to-p", n: 10, mean: 11 })).toThrow(/平均/);
    expect(() => solveApply({ method: "boundary", n: 10, p: 0.3, k: 11 })).toThrow(/k は/);
    expect(() => solveApply({ method: "solve-spread", n: 10, p: 0.3, variance: 1 })).toThrow(/小さい/);
    expect(() => solveApply({ method: "max-strength", mechanism: { kind: "bernoulli", n: 10, p: 0.5 }, param: "carry", min: 0, max: 1, step: 0.1, ratio: 1.1 })).toThrow(/強さ/);
  });
});
