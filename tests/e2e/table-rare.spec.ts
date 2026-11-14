// 期待値の実験室 A-03（まれでも大きい当たりが1本ある表。開く先 rare。kn-experiment の改訂10。stats2-course #119）。
// 見本（教材の公開データの写し）の A-03 をそのまま使う（2026-11-14 の公開で入った。テーマの rare と評価の応用）。
import { test, expect, type Page } from "@playwright/test";

const SRC = "src=sample/stats2.json";
const X = encodeURIComponent("stats2:EXP-expect-table");
const Q = encodeURIComponent("stats2:expect-A-03");
const errorsOf = (page: Page) => {
  const errs: string[] = [];
  page.on("pageerror", (e) => errs.push(e.message));
  return errs;
};

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
});

// 確かめる対象：A-03 の流れ。
//   予測：元の表の期待値（38円）を見せ、選び肢は元の期待値の 1.2 倍・1.6 倍が境目（45.6円・60.8円）。照らしは理論（38→137円）から決まる。
//   実験：元の表は「同じ引きで、替えた1本が元の 100円だったら」として写す。だから引いた平均の差は、いつも 9900×（大当たりの回数）÷回数 になる。
//   観察：中央値（引いた）は 2つの表とも 0円（はずれが 80 本で、真ん中の 50・51 番目ははずれ）。ずれの目安は 2√(20356/N)・2√(1002931/N)（手で求めた分散）。
//   考察：1万×1/100＝100円の項が、ほかの項の和 37円より大きい。中央値は 100 本を並べた 50・51 番目で決まる。
//   応用：評価（平均と中央値がいちばん離れる表）。B（1点 51人・5点 49人）は平均 2.96・中央値 1 で差 1.96。
// 想定する故障：元の表を別の種で引く（違いが大当たりの回だけでなくなる）・中央値を平均で出す・予測の境目を 1.1 倍・2 倍のままにする・
//   ずれの目安で替えた表の分散を使わない・考察の項の数を取り違える・応用の answer の番号と選び肢がずれる。
// 見つけ方：くじで1つ目の選び肢（違う予測）→ ✗ と「38円 → 137円」、1000 回引いて平均の差と大当たりの回数の関係、中央値の行、目安の数、考察の数、応用の照らしを見る。
// 既存との違い：table-support.spec.ts（A-02）・table-same-mean.spec.ts（D-01）は別の表と問い。table-apply.spec.ts は A-01・A-02・D-01 の応用。ここは1本を替えた表と中央値。
// 検出の確かめ（2026-11-14）：元の表を写さず同じ表から別に平均を出すと差の関係で、中央値を平均にすると中央値の行で、
//   境目を 1.1 倍にすると選び肢の名前で落ちることを見た
test("A-03：1本を替えた表。予測（倍率の範囲）→ 同じ引きで比べる → 平均と中央値 → 項に開く → 応用", async ({ page }) => {
  const errs = errorsOf(page);
  await page.goto(`./?${SRC}&x=${X}&q=${Q}`);
  const x = page.getByTestId("experiment");
  await expect(x.getByTestId("exp-question")).toContainText("まれでも大きい当たりが1本あると？");
  await x.getByRole("radio", { name: /くじ/ }).click();
  await expect(x.getByTestId("exp-base-mean")).toContainText("38円");
  await expect(x.getByTestId("exp-marker")).toHaveCount(0); // 予測する量（替えた表の期待値）は予測の前に出さない
  const pred = x.getByTestId("exp-pred-rare");
  await expect(pred.getByRole("radio")).toHaveText(["45.6円 まで", "45.6〜60.8円", "60.8円 より大きい"]);
  await pred.getByRole("radio", { name: "45.6円 まで" }).click();
  await x.getByRole("button", { name: "この予測で引いてみる" }).click();
  await x.getByTestId("exp-run-1000").click();
  await expect(x.getByTestId("exp-nohit")).toContainText("を1回も引かないのは");
  await x.getByTestId("exp-to-observe").click();
  const v = x.getByTestId("exp-verdict");
  await expect(v).toContainText("✗ 予測と違った");
  await expect(v).toContainText("期待値は 38円 → 137円");
  await expect(v).toContainText("予測は「45.6円 まで」");
  // 同じ引きで比べている：替えた表の平均 − 元の表の平均 ＝ (10000−100)×大当たりの回数÷回数
  const tbl = x.getByTestId("exp-rare-table");
  const n = Number((await tbl.locator("thead th").first().innerText()).replace(/[^\d]/g, ""));
  expect(n).toBeGreaterThanOrEqual(1000);
  const cells = async (row: string) =>
    (await tbl.getByTestId(row).locator("td").allInnerTexts()).slice(1).map((t) => Number(t.replace(/[^\d.]/g, "")));
  const [mb, mr] = await cells("exp-row-mean");
  const hits = Number((await tbl.innerText()).match(/のうち (\d+) 回/)![1]);
  expect(Math.abs(mr! - mb! - (9900 * hits) / n)).toBeLessThan(0.011); // 表示は小数2桁まで
  expect(await cells("exp-row-median")).toEqual([0, 0]);
  expect(await cells("exp-row-theory")).toEqual([38, 137]);
  const mg = await x.getByTestId("exp-mean-margin").innerText();
  const [, wb, wr] = mg.match(/±([\d.]+)円（元の表）・±([\d.]+)円（替えた表）/)!;
  const fmt = (v: number) => (v >= 10 ? String(Math.round(v)) : String(Number(v.toPrecision(2))));
  expect(wb).toBe(fmt(2 * Math.sqrt(20356 / n)));
  expect(wr).toBe(fmt(2 * Math.sqrt(1002931 / n)));
  await expect(x.getByTestId("exp-mean-margin")).toContainText("最大で約9.8%");
  await expect(x.getByTestId("exp-range-freq")).toContainText("近似したおおよその値");
  await expect(x.getByTestId("exp-look")).not.toContainText("落ち着かない"); // 平均の落ち着き方は B-01・B-02 で
  await x.getByRole("button", { name: /理由を考える/ }).click();
  await expect(x.getByTestId("exp-rare-term")).toContainText("1万×1/100＝100円");
  await expect(x.getByTestId("exp-rare-term")).toContainText("ほかの項の和（37円）より大きい");
  await expect(x.getByTestId("exp-median-why")).toContainText("100 本を並べたら 50・51 番目");
  await x.getByRole("button", { name: "応用の課題へ" }).click();
  const a = x.getByTestId("exp-apply");
  await expect(a).toHaveAttribute("data-kind", "評価");
  await a.getByRole("radio", { name: "A" }).click(); // 平均がいちばん大きく、大きな値を持つ表（見当で選びやすい側）
  await a.getByTestId("exp-apply-check").click();
  await expect(a.getByTestId("exp-apply-verdict")).toHaveAttribute("data-ok", "false");
  await expect(a.getByTestId("exp-apply-answer")).toHaveText("B");
  await expect(a.getByTestId("exp-apply-steps")).toContainText("1.96");
  expect(errs).toEqual([]);
});

// 確かめる対象：テーマごとに答えの選び肢が変わる（くじは3つ目、買い上げ点数は2つ目）。中央値は 2点のまま。
// 想定する故障：照らしの範囲をくじの数で決め打ちする・rare のないテーマ（さいころ）を出す。
// 見つけ方：買い上げ点数（元 2.1点 → 3.05点。1.45 倍）で真ん中を選んで ✓、さいころのテーマがないこと。
// 検出の確かめ（2026-11-14）：themes を rare で絞らないとさいころが出て落ちることを見た
test("A-03：買い上げ点数は真ん中の範囲が答えで、さいころは出さない", async ({ page }) => {
  await page.goto(`./?${SRC}&x=${X}&q=${Q}`);
  const x = page.getByTestId("experiment");
  await expect(x.getByRole("radiogroup", { name: "テーマ" }).getByRole("radio")).toHaveCount(2);
  await expect(x.getByRole("radio", { name: /さいころ/ })).toHaveCount(0);
  await x.getByRole("radio", { name: /買い上げ点数/ }).click();
  await expect(x.getByTestId("exp-base-mean")).toContainText("2.1点");
  await x.getByTestId("exp-pred-rare").getByRole("radio", { name: "2.52〜3.36点" }).click();
  await x.getByRole("button", { name: "この予測で引いてみる" }).click();
  await x.getByTestId("exp-run-1000").click();
  await x.getByTestId("exp-to-observe").click();
  await expect(x.getByTestId("exp-verdict")).toContainText("✓ 予測どおり");
  await expect(x.getByTestId("exp-verdict")).toContainText("2.1点 → 3.05点");
  const med = (await x.getByTestId("exp-row-median").locator("td").allInnerTexts()).slice(1);
  expect(med).toEqual(["2点", "2点"]);
});
