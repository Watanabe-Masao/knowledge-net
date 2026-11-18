// 観察の照らし（実験・理論・ずれ）の桁（stats2-course #200。渡辺さんの iPhone の画面 2026-11-18）。
import { test, expect } from "@playwright/test";

const SRC = "src=sample/stats2.json";
const num = (t: string) => {
  const m = t
    .replace(/[＋+]/, "")
    .replace("−", "-")
    .match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : NaN;
};
const dec = (t: string) => t.match(/\.(\d+)/)?.[1]?.length ?? 0;

// 確かめる対象：分布の比べ（q-cmprows）と照らしの表（q-cmp）の各行で、実験・理論・ずれ（・目安）が同じ小数の桁で出て、見えている 実験−理論 が見えている ずれ になること。
// 想定する故障：末尾の 0 を落として 27.0% を 27% と出す・ずれだけ有効数字2桁で 0.32／−0.083 と出す（26.6% − 26.7% が −0.083 に見える）・丸めて 0 のずれに「−0」と出す・丸める前の差を丸めて 3.4% − 2.8% を ＋0.5 と出す（渡辺さんの画面 17:38）。
// 見つけ方：B-01 の観察の段の2つの表の全部の行の文字を読み、桁と引き算と符号を確かめる（実験の乱数によらない性質で見る）。
// 既存との違い：binom-b01-apply は応用の段のカードだけ、countFormat.test は回数の書き方の関数だけを見て、画面の表の行どうしの桁は見ていない。
// 検出の確かめ（2026-11-18）：QuestionParts を元の書き方（末尾の 0 を落とす・ずれは有効数字2桁）に戻すと落ちることを見た（分布の 0 回：3%・＋0.2）。ずれを丸める前の差に戻すと、1,001 セットの分布で落ちることも見た（23.1% − 23.3% が −0.3）
test("観察の照らし：1つの行の数は同じ桁で、見えている 実験−理論 が ずれ になる", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`./?${SRC}&x=stats2:EXP-binom-p&q=stats2:binom-B-01`);
  const x = page.getByTestId("experiment");
  await expect(x.getByRole("radiogroup").first()).toBeVisible();
  for (const g of await x.getByRole("radiogroup").all()) await g.getByRole("radio").first().click();
  await x.getByRole("button", { name: "この予測で実験する" }).click();
  // セット数を割り切れない数（1,001）にする：割合が小数1桁でぴったりでない行で、丸め方の誤りが表に出る
  await x.getByTestId("exp-run-1").click();
  await x.getByTestId("exp-run-big").click();
  await expect(x.getByTestId("exp-to-observe")).toBeEnabled({ timeout: 15000 });
  await x.getByTestId("exp-to-observe").click();
  await expect(x).toContainText("1,001 セット", { timeout: 20000 });

  const check = (where: string, exp: string, th: string, d: string, se?: string) => {
    if (th.startsWith("<")) return; // 理論が 0.1% 未満の行は「<0.1%」（丸めて 0 に見せない）
    const dp = dec(d);
    // 実験の回数（% のない整数）だけは整数のまま
    expect(/^\d+$/.test(exp) ? dp : dec(exp), `${where}：実験の桁（${exp}・${d}）`).toBe(dp);
    expect(dec(th), `${where}：理論の桁（${th}・${d}）`).toBe(dp);
    if (se !== undefined) expect(dec(se), `${where}：目安の桁（${se}・${d}）`).toBe(dp);
    expect(d, `${where}：0 のずれに符号`).not.toMatch(/^[−＋]0(\.0+)?$/);
    expect(Math.abs(num(exp) - num(th) - num(d)), `${where}：${exp} − ${th} が ${d} にならない`).toBeLessThanOrEqual(
      1e-9, // 見えている数どうしでぴったり（丸める前の差を丸めると 3.4% − 2.8% が ＋0.5 になる）
    );
  };
  // 表は1回で読む（セルを1つずつ読むと、その間に数が動いた行を食い違いと見誤る）
  const dist = await x
    .getByTestId("q-cmprows")
    .evaluate((el) =>
      [...el.querySelectorAll("[role=listitem]")].map((li) =>
        [...li.querySelectorAll(":scope > span")].map((e) => e.textContent ?? ""),
      ),
    );
  expect(dist.length).toBeGreaterThan(0);
  for (const c of dist) check(`分布の ${c[0]}`, c[2]!, c[3]!, c[4]!);
  const cmp = await x.getByTestId("q-cmp").evaluate((el) =>
    [...el.querySelectorAll("tbody tr")].map((tr) => {
      const td = [...tr.querySelectorAll("td")],
        small = td[3]?.querySelector("small");
      return {
        label: td[0]?.textContent ?? "",
        exp: td[1]?.textContent ?? "",
        th: td[2]?.textContent ?? "",
        d: (td[3]?.firstChild?.textContent ?? "").trim(),
        se: (small?.textContent ?? "")
          .replace(/\s*[中外]\s*$/, "")
          .replace("±", "")
          .trim(),
      };
    }),
  );
  expect(cmp.length).toBeGreaterThan(0);
  for (const r of cmp) check(`照らしの ${r.label}`, r.exp, r.th, r.d, r.se);
});
