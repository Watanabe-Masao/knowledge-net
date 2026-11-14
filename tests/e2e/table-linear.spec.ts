// 期待値の実験室 C-01（全部の値を a 倍して b 足す。開く先 linear。kn-experiment の改訂11。stats2-course #119）。
// 見本にはまだ C-01 の linear と応用がないので、読み込みを書き換えて足す（CLAUDE.md「テストの見本」）。
import { test, expect, type Page } from "@playwright/test";

const SRC = "src=sample/stats2.json";
const X = encodeURIComponent("stats2:EXP-expect-table");
const Q = encodeURIComponent("stats2:expect-C-01");
const LINEAR: Record<string, object> = {
  lottery: { a: 0.5, b: -10, change: "賞金を全部半額にし、はずれも含めて全員から参加費 10 円を引く" },
  dice: { a: 0.5, b: 3, change: "出た目を半分にして 3 足す" },
  basket: { a: 10, b: 5, change: "ポイント＝点数×10＋来店の 5 ポイント" },
};
const APPLY = {
  kind: "変換",
  task: "くじ（はずれ 80 本・100円 18 本・1000円 2 本。期待値 38円）で、当たりの賞金だけを 2 倍して 50 円上乗せする（はずれは 0 円のまま）。新しいくじの期待値は何円？",
  solve: { method: "table-transform-mean", values: [0, 100, 1000], weights: [80, 18, 2], a: 2, b: 50, only: [1, 2] },
  answer: { type: "number", unit: "円", tol: { abs: 0.05 } },
  why: "値ごとに変え方が違う（aX＋b の形でない）なら、変えたあとの表から期待値を求め直す。",
};
async function withLinear(page: Page) {
  await page.route("**/sample/stats2.json", async (r) => {
    const d = await (await r.fetch()).json();
    const x = d.experiments.find((e: { id: string }) => e.id === "stats2:EXP-expect-table");
    for (const t of x.themes) if (LINEAR[t.id]) t.linear = LINEAR[t.id];
    for (const g of x.catalog)
      for (const it of g.items) if (it.id === "stats2:expect-C-01") Object.assign(it, { open: "linear", apply: APPLY });
    await r.fulfill({ json: d });
  });
}
const fmt = (v: number) => (v >= 10 ? String(Math.round(v)) : String(Number(v.toPrecision(2))));

test.beforeEach(async ({ page }) => {
  await withLinear(page);
  await page.setViewportSize({ width: 390, height: 844 });
});

// 確かめる対象：C-01 の流れ。
//   予測：元の期待値と、変え方（a・b に言葉）を見せ、選び肢は a×m＋b（正）・a×(m＋b)・a×m の具体の数を小さい順に。
//     くじ（半額にして全員から 10 円引く。a＝0.5・b＝−10）は 9・14・19 円で、正しい答えはいちばん小さい（テーマで答えの位置が変わる）。
//   観察：照らしは理論（38→9円）。平均（引いた）の行で、変えた値は同じ引きを 0.5 倍して 10 引いて写す。ずれの目安は元 2√(20356/N)、変えた値はその 0.5 倍。
//     「a×元の引いた平均＋b」の等式は観察では出さない（作り方から決まる。考察で出す）。
//   考察：Σ(ax＋b)p＝0.5×38−10×1＝9 と、引いた値の平均でも同じ計算になること。
//   応用：当たりだけ変えると 86 円（公式をそのまま使うと 126 円）。
// 想定する故障：選び肢を答えの位置で固定する・変えた値を別の引きで作る・b の符号を取り違える（−10 を ＋10）・観察で答えの等式を出す・
//   目安の幅を変換で変えない。
// 見つけ方：くじで 14 円（違う予測）→ ✗ と「38円 → 9円」、平均の行の関係、目安の数、観察と考察の文、応用の照らし。
// 既存との違い：table-rare.spec.ts（A-03）は1つを替えた表。ここは全部の値の変換。
// 検出の確かめ（2026-11-15）：選び肢を並べ替えないと名前の順で、b を足すとき符号を落とすと照らしで、
//   観察に等式を戻すと exp-linear-check の数で落ちることを見た
test("C-01：全部の値を変える。予測（具体の数）→ 同じ引きで写す → 平均と期待値 → 項に開く → 応用", async ({ page }) => {
  const errs: string[] = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(`./?${SRC}&x=${X}&q=${Q}`);
  const x = page.getByTestId("experiment");
  await x.getByRole("radio", { name: /くじ/ }).click();
  await expect(x.getByTestId("exp-base-mean")).toContainText("38円");
  await expect(x.getByTestId("exp-ab")).toContainText("a＝0.5（何倍にするか）・b＝-10");
  const pred = x.getByTestId("exp-pred-linear");
  await expect(pred.getByRole("radio")).toHaveText(["9円", "14円", "19円"]);
  await pred.getByRole("radio", { name: "14円" }).click();
  await x.getByRole("button", { name: "この予測で引いてみる" }).click();
  await x.getByTestId("exp-run-100").click();
  await x.getByTestId("exp-to-observe").click();
  const v = x.getByTestId("exp-verdict");
  await expect(v).toContainText("✗ 予測と違った");
  await expect(v).toContainText("期待値は 38円 → 9円");
  await expect(v).toContainText("予測は「14円」");
  const tbl = x.getByTestId("exp-linear-table");
  const n = Number((await tbl.locator("thead th").first().innerText()).replace(/[^\d]/g, ""));
  const cells = async (row: string) =>
    (await tbl.getByTestId(row).locator("td").allInnerTexts()).slice(1).map((t) => Number(t.replace(/[^\d.-]/g, "")));
  const [mb, my] = await cells("exp-row-mean");
  expect(Math.abs(my! - (0.5 * mb! - 10))).toBeLessThan(0.011); // 同じ引きを写す（表示は小数2桁まで）
  expect(await cells("exp-row-theory")).toEqual([38, 9]);
  await expect(x.getByTestId("exp-linear-check")).toHaveCount(0); // 等式は観察では出さない
  const mg = await x.getByTestId("exp-mean-margin").innerText();
  const [, wb, wy] = mg.match(/元の値 ±([\d.]+)円・変えた値 ±([\d.]+)円/)!;
  const w = 2 * Math.sqrt(20356 / n);
  expect(wb).toBe(fmt(w));
  expect(wy).toBe(fmt(0.5 * w));
  await expect(x.getByTestId("exp-mean-margin")).toContainText("外に出るときは一緒に出る");
  await expect(x.getByTestId("exp-mean-margin")).not.toContainText("9.8%");
  await x.getByRole("button", { name: /理由を考える/ }).click();
  await expect(x.getByTestId("exp-linear-why")).toContainText("0.5×38−10×1＝9");
  await expect(x.getByTestId("exp-linear-check")).toContainText("引いた値の平均でも同じ計算になる");
  await x.getByRole("button", { name: "応用の課題へ" }).click();
  const a = x.getByTestId("exp-apply");
  await expect(a).toHaveAttribute("data-kind", "変換");
  await a.getByTestId("exp-apply-input").fill("126"); // 公式をそのまま使った答え（わな）
  await a.getByTestId("exp-apply-check").click();
  await expect(a.getByTestId("exp-apply-verdict")).toHaveAttribute("data-ok", "false");
  await expect(a.getByTestId("exp-apply-answer")).toContainText("86");
  expect(errs).toEqual([]);
});

// 確かめる対象：テーマで正しい答えの位置が変わる（さいころは 0.5 倍して 3 足すので 4.75 がいちばん大きい。買い上げ点数は 26 が真ん中）。
// 想定する故障：照らしの番号を並べ替える前の順で決める（いつも1つ目が正しい、など）。
// 見つけ方：さいころで 4.75（3つ目）を選んで ✓、買い上げ点数で 26（2つ目）を選んで ✓。
// 検出の確かめ（2026-11-15）：actual を並べ替え前の番号（0）にすると落ちることを見た
test("C-01：テーマで正しい答えの位置が変わる", async ({ page }) => {
  await page.goto(`./?${SRC}&x=${X}&q=${Q}`);
  const x = page.getByTestId("experiment");
  for (const [theme, pick, want] of [
    [/さいころ/, "4.75", ["1.75", "3.25", "4.75"]],
    [/買い上げ点数/, "26点", ["21点", "26点", "71点"]],
  ] as const) {
    await x.getByRole("radio", { name: theme }).click();
    const pred = x.getByTestId("exp-pred-linear");
    await expect(pred.getByRole("radio")).toHaveText([...want]);
    await pred.getByRole("radio", { name: pick }).click();
    await x.getByRole("button", { name: "この予測で引いてみる" }).click();
    await x.getByTestId("exp-run-100").click();
    await x.getByTestId("exp-to-observe").click();
    await expect(x.getByTestId("exp-verdict")).toContainText("✓ 予測どおり");
    await x.getByRole("button", { name: /理由を考える/ }).click();
    await x.getByRole("button", { name: "応用の課題へ" }).click();
    await x.getByRole("button", { name: "別のテーマで試す" }).click();
  }
});
