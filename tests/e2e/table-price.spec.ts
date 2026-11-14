// 期待値の実験室 E-01（値段を払って引く。開く先 price。kn-experiment の改訂12。stats2-course #119）。
// 見本にはまだ E-01 の price と応用がないので、読み込みを書き換えて足す（CLAUDE.md「テストの見本」）。
import { test, expect, type Page } from "@playwright/test";

const SRC = "src=sample/stats2.json";
const X = encodeURIComponent("stats2:EXP-expect-table");
const Q = encodeURIComponent("stats2:expect-E-01");
const PRICE: Record<string, object> = {
  lottery: { c: 30, word: "値段", change: "このくじを 1 枚 30 円で買う" },
  dice: { c: 4, word: "参加費", change: "参加費 4 円を払ってさいころを1回振り、出た目の数だけ円をもらう" },
};
const APPLY = {
  kind: "評価",
  task: "3つのくじ（各 100 本）。何度も買うなら、1枚あたりの損得の平均がいちばん得なのはどれ？",
  solve: {
    method: "table-best-net",
    tables: [
      { values: [0, 200, 500], weights: [87, 10, 3], price: 25, name: "A" },
      { values: [0, 100, 300], weights: [74, 25, 1], price: 20, name: "B" },
      { values: [0, 500, 1000], weights: [83, 15, 2], price: 90, name: "C" },
    ],
    unit: "円",
  },
  answer: { type: "choice", options: ["A", "B", "C"] },
  why: "何度も買うときの得は、期待値−値段で比べる。",
};
async function withPrice(page: Page) {
  await page.route("**/sample/stats2.json", async (r) => {
    const d = await (await r.fetch()).json();
    const x = d.experiments.find((e: { id: string }) => e.id === "stats2:EXP-expect-table");
    for (const t of x.themes) if (PRICE[t.id]) t.price = PRICE[t.id];
    for (const g of x.catalog)
      for (const it of g.items) if (it.id === "stats2:expect-E-01") Object.assign(it, { open: "price", apply: APPLY });
    await r.fulfill({ json: d });
  });
}
const fmt = (v: number) => (v >= 10 ? String(Math.round(v)) : String(Number(v.toPrecision(2))));

test.beforeEach(async ({ page }) => {
  await withPrice(page);
  await page.setViewportSize({ width: 390, height: 844 });
});

// 確かめる対象：E-01 の流れ。
//   予測：表と値段は見せ、期待値は見せない（期待値で決まること自体が発見）。三択（得・損得なし・損）。
//   観察：照らしは理論（くじは 38−30＝+8円 で得）で、理由（引き算）は言わない。損得の平均と損した回の割合（はずれ 80%）を引いた値と理論で並べる。
//     ずれの目安は 損得 2√(20356/N)・損した回の割合 200√(0.16/N) ポイント。2行のどちらかが外に出るのは「最大で」。
//   考察：損得の表を項に開き（+8円）、変換の式は C-01 へ、まれな大きい額は A-03 へ、題を添えて案内する。
//   応用：評価。期待値で選ぶと C、値段の安さで選ぶと B で、答えは A（+10円。損する割合はいちばん大きい 87%）。
// 想定する故障：予測の前に期待値を出す・値段を引き忘れて照らす（38 で「得」には変わらないが、さいころでは 3.5 で得になる）・
//   損した回に同じ額を入れる（さいころの 4 は損得なし）・案内を開けない問いにも出す。
// 見つけ方：くじで「平均で損」→ ✗ と「+8円（平均で得）」、表と目安の数、考察の案内、応用の照らし。さいころは別のテストで損と 50%。
// 既存との違い：table-linear.spec.ts（C-01）は値の変換。ここは値段を払う損得と損した回。
// 検出の確かめ（2026-11-15）：値段を引かないとさいころの照らしで、損した回に同じ額を入れるとさいころの 50% で、
//   予測の段に期待値を出すと exp-marker・文字で落ちることを見た
test("E-01：値段を払って引く。予測（得・損）→ 1000 回 → 損得の平均と損した回 → 項に開く → 応用", async ({ page }) => {
  const errs: string[] = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(`./?${SRC}&x=${X}&q=${Q}`);
  const x = page.getByTestId("experiment");
  await x.getByRole("radio", { name: /くじ/ }).click();
  await expect(x.getByTestId("exp-price")).toContainText("1回 30円");
  await expect(x).not.toContainText("38円"); // 期待値は予測の前に見せない
  await expect(x.getByTestId("exp-marker")).toHaveCount(0);
  await x.getByTestId("exp-pred-net").getByRole("radio", { name: "平均で損" }).click();
  await x.getByRole("button", { name: "この予測で引いてみる" }).click();
  await x.getByTestId("exp-run-1000").click();
  await x.getByTestId("exp-to-observe").click();
  const v = x.getByTestId("exp-verdict");
  await expect(v).toContainText("✗ 予測と違った");
  await expect(v).toContainText("+8円（平均で得）");
  await expect(v).toContainText("予測は「平均で損」");
  await expect(v).not.toContainText("38"); // 照らしで理由（38−30）を言わない
  const tbl = x.getByTestId("exp-net-table");
  const n = Number((await tbl.locator("thead th").first().innerText()).replace(/[^\d]/g, ""));
  await expect(tbl.getByTestId("exp-row-net").locator("td").nth(2)).toHaveText("+8円");
  await expect(tbl.getByTestId("exp-row-loss").locator("td").nth(2)).toHaveText("80%");
  const mg = await x.getByTestId("exp-mean-margin").innerText();
  const [, w1, w2] = mg.match(/損得の平均 ±([\d.]+)円・損した回の割合 ±([\d.]+) ポイント/)!;
  expect(w1).toBe(fmt(2 * Math.sqrt(20356 / n)));
  expect(w2).toBe(fmt(200 * Math.sqrt(0.16 / n)));
  await expect(x.getByTestId("exp-flip-freq")).toContainText("最大で約9.8%");
  await x.getByRole("button", { name: /理由を考える/ }).click();
  await expect(x.getByTestId("exp-net-why")).toContainText("+8円");
  await expect(x.getByTestId("exp-net-why")).toContainText("「C-01 ");
  await expect(x.getByTestId("exp-loss-why")).toContainText("「A-03 ");
  await x.getByRole("button", { name: "応用の課題へ" }).click();
  const a = x.getByTestId("exp-apply");
  await expect(a).toHaveAttribute("data-kind", "評価");
  await a.getByRole("radio", { name: "C" }).click(); // 期待値がいちばん大きいくじ（見当で選びやすい側）
  await a.getByTestId("exp-apply-check").click();
  await expect(a.getByTestId("exp-apply-verdict")).toHaveAttribute("data-ok", "false");
  await expect(a.getByTestId("exp-apply-answer")).toHaveText("A");
  await expect(a.getByTestId("exp-apply-steps")).toContainText("87%");
  expect(errs).toEqual([]);
});

// 確かめる対象：さいころ（参加費 4 円）は 3.5−4＝−0.5 で損。損した回は 1・2・3 の目（4 は損得なし）で 50%。
// 想定する故障：値段の呼び名をくじのまま出す・損した回に同じ額を入れる（4 も入れると 66.7%）・値段を引き忘れる。
// 見つけ方：さいころで「平均で損」を選んで ✓、値段の呼び名が「参加費」、損した回の理論が 50%。
// 検出の確かめ（2026-11-15）：x < c を x <= c にすると 66.7% で落ちることを見た
test("E-01：さいころは参加費で、平均で損。損した回は 4 を入れない", async ({ page }) => {
  await page.goto(`./?${SRC}&x=${X}&q=${Q}`);
  const x = page.getByTestId("experiment");
  await x.getByRole("radio", { name: /さいころ/ }).click();
  await expect(x.getByTestId("exp-price")).toContainText("参加費");
  await x.getByTestId("exp-pred-net").getByRole("radio", { name: "平均で損" }).click();
  await x.getByRole("button", { name: "この予測で引いてみる" }).click();
  await x.getByTestId("exp-run-1000").click();
  await x.getByTestId("exp-to-observe").click();
  await expect(x.getByTestId("exp-verdict")).toContainText("✓ 予測どおり");
  await expect(x.getByTestId("exp-verdict")).toContainText("-0.5円（平均で損）");
  await expect(x.getByTestId("exp-row-loss").locator("td").nth(2)).toHaveText("50%");
});
