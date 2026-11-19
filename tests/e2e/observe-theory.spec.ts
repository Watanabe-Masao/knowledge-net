// 観察の段の「理論」の数（stats2-course #118 の層5：画面に出した数を計算し直して照らす。M8 の残り）。
import { test, expect } from "@playwright/test";

const SRC = "src=sample/stats2.json";

// 期待値は engine を使わず、この中で二項分布の式から直接計算する（独立性：画面と期待値が同じ誤りを共有しない。CLAUDE.md の確かめるの3）
const comb = (n: number, k: number) => {
  let c = 1;
  for (let i = 1; i <= k; i++) c = (c * (n - k + i)) / i;
  return c;
};
const pmf = (n: number, p: number, k: number) => comb(n, k) * p ** k * (1 - p) ** (n - k);
const pct = (t: string) => Number(t.replace("%", "").replace("<", ""));

// 確かめる対象：二項分布 B-01 の観察の段で、学習者に見せる理論の数（分布の各行の理論の確率・照らしの表の理論の割合と回数・ずれの目安）が、
//   問いの条件（10 回・p＝0.3・ちょうど 3 回・1,000 セット）から二項分布の式で求めた値と同じであること。
// 想定する故障：理論の列に別の n・p の値を出す（実験の初期値 n＝10・p＝0.5 のまま）・確率関数の指数や組合せの数の誤り・
//   ずれの目安を 2×標準誤差でなく1倍や √ の取り忘れで出す・回数の理論をセット数を掛け忘れて出す。
// 見つけ方：表を1回で読み、行ごとに式の値を小数1桁に丸めて照らす（0.1% 未満は「<0.1%」）。目安は 2√(p(1−p)/N)。
// 既存との違い：cmp-digits.spec.ts は、桁と「実験−理論＝ずれ」の引き算だけを見て、理論の数そのものが正しいかは見ない。
//   binom-b01-apply.spec.ts は応用の段のカードの 26.7%・15.7% だけ。engine の単体テストは数式の値で、画面に出た数は見ない。
// 検出の確かめ（2026-11-20）：engine の二項分布の確率関数の (1−p) の指数を n−k+1 にすると、この表の行で落ちることを見た
test("観察の段：理論の確率・回数・ずれの目安が、問いの条件から二項分布の式で求めた値と同じ", async ({ page }) => {
  const n = 10,
    p = 0.3,
    k = 3,
    N = 1000;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`./?${SRC}&x=stats2:EXP-binom-p&q=stats2:binom-B-01`);
  const x = page.getByTestId("experiment");
  await expect(x.getByRole("radiogroup").first()).toBeVisible();
  for (const g of await x.getByRole("radiogroup").all()) await g.getByRole("radio").first().click();
  await x.getByRole("button", { name: "この予測で実験する" }).click();
  await x.getByTestId("exp-run-big").click();
  await expect(x.getByTestId("exp-to-observe")).toBeEnabled({ timeout: 15000 });
  await x.getByTestId("exp-to-observe").click();
  await expect(x).toContainText("1,000 セット", { timeout: 20000 });

  const dist = await x
    .getByTestId("q-cmprows")
    .evaluate((el) =>
      [...el.querySelectorAll("[role=listitem]")].map((li) =>
        [...li.querySelectorAll(":scope > span")].map((e) => e.textContent ?? ""),
      ),
    );
  expect(dist.length, "分布の行が 0〜n の全部").toBe(n + 1);
  for (const c of dist) {
    const kk = Number(c[0]!.replace(/[^0-9]/g, ""));
    const want = pmf(n, p, kk) * 100;
    if (want < 0.05) expect(c[3], `${kk} 回の理論`).toBe("<0.1%");
    else expect(pct(c[3]!), `${kk} 回の理論`).toBeCloseTo(Number(want.toFixed(1)), 5);
  }

  const cmp = await x.getByTestId("q-cmp").evaluate((el) =>
    [...el.querySelectorAll("tbody tr")].map((tr) => {
      const td = [...tr.querySelectorAll("td")];
      return { th: td[2]?.textContent ?? "", se: td[3]?.querySelector("small")?.textContent ?? "" };
    }),
  );
  const q = pmf(n, p, k),
    se = 2 * Math.sqrt((q * (1 - q)) / N);
  expect(cmp.length).toBe(2);
  expect(pct(cmp[0]!.th), "割合の理論").toBeCloseTo(Number((q * 100).toFixed(1)), 5);
  expect(Number(cmp[1]!.th.replace(/,/g, "")), "回数の理論").toBeCloseTo(Number((q * N).toFixed(1)), 5);
  const num = (t: string) => Number(t.replace(/[^0-9.]/g, ""));
  expect(num(cmp[0]!.se), "割合のずれの目安（2×標準誤差）").toBeCloseTo(Number((se * 100).toFixed(1)), 5);
  expect(num(cmp[1]!.se), "回数のずれの目安").toBeCloseTo(Number((se * N).toFixed(1)), 5);
});
