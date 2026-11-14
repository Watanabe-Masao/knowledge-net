// 期待値の実験室 B-01（何度も引くと、平均は期待値に近づく？ B-02 をまとめた。開く先 lln。kn-experiment の改訂13。stats2-course #119）。
// 見本にはまだ B-01 の lln・反例の cutoffs・応用がないので、読み込みを書き換えて足す（CLAUDE.md「テストの見本」）。
import { test, expect, type Page } from "@playwright/test";

const SRC = "src=sample/stats2.json";
const X = encodeURIComponent("stats2:EXP-expect-table");
const Q = encodeURIComponent("stats2:expect-B-01");
const cut = (K: number) => ({
  values: Array.from({ length: K }, (_, i) => 2 ** (i + 1)),
  weights: [...Array.from({ length: K - 1 }, (_, i) => 2 ** (K - 1 - i)), 2],
});
const APPLY = {
  kind: "反証",
  task: "倍々のくじを 1000 回引いた平均が 15 円だった。打ち切り 10 回の表と打ち切り 20 回の表の、どちらと矛盾する？",
  solve: {
    method: "table-mean-which",
    tables: [
      { ...cut(10), name: "打ち切り 10 回の表" },
      { ...cut(20), name: "打ち切り 20 回の表" },
    ],
    n: 1000,
    observed: 15,
    unit: "円",
  },
  answer: { type: "choice", options: ["打ち切り 10 回の表", "打ち切り 20 回の表"] },
  why: "目安で判断してよいのは、ずれの分布が正規分布に近い表。",
};
async function withLln(page: Page) {
  await page.route("**/sample/stats2.json", async (r) => {
    const d = await (await r.fetch()).json();
    const x = d.experiments.find((e: { id: string }) => e.id === "stats2:EXP-expect-table");
    for (const c of x.counterexamples) if (c.id === "doubling") c.cutoffs = [10, 20, 40];
    for (const g of x.catalog)
      for (const it of g.items) if (it.id === "stats2:expect-B-01") Object.assign(it, { open: "lln", apply: APPLY });
    await r.fulfill({ json: d });
  });
}

test.beforeEach(async ({ page }) => {
  await withLln(page);
  await page.setViewportSize({ width: 390, height: 844 });
});

// 確かめる対象：B-01 の流れ。
//   予測：打ち切り 20 回の倍々のくじ（期待値 21 円）を 1000 回引いた平均は、期待値より下・上・同じくらいのどれが多いか。
//     照らしは決まった種のくり返し（1000 回の実験を 2000 組）で、下に出るのは約 84%（独立に Python で求めた値。⑦ の監査役も検算）→ 答えは「下」。
//   実験：打ち切り 10・20・40 回を 1000 回ずつ引いてから観察へ。
//   観察：期待値は 11・21・41 円（項がどれも 1。K＋1）。ずれの目安は ±3.4円・±110円・±11万円（有効数字2桁。2√((3·2^K−2−(K＋1)²)/1000)）。
//   考察：打ち切り 40 回の期待値 41 のうち 2¹¹ 円以上が 31 円分。1000 回で 2¹¹ 円以上を引くのは約 62%、2¹⁵ 円以上は約 5.9%。
//     目安を ±4.1 円にするのに要る回数は約 7,800億 回（(2σ/4.1)²）。
//   応用：平均 15 円は打ち切り 10 回の表と矛盾する（ずれ 4＞3.43）。20 回の表とは矛盾しない（6≦112）。
// 想定する故障：照らしを正規近似で決める（「同じくらい」になる）・倍々のくじの重みの切り直しの誤り（期待値が K＋1 にならない）・
//   目安の桁の出し方の誤り・3つ引く前に観察へ進める・応用の答えの番号と選び肢がずれる。
// 見つけ方：「上と下が同じくらい」→ ✗ と「おおよそ 84%」、期待値の列、目安の数、考察の数、応用の照らし。
// 既存との違い：table-price.spec.ts（E-01）など、ほかの問いは1つの表。ここは打ち切りを変えた3つの表と、くり返しで求めた頻度。
// 検出の確かめ（2026-11-15）：重みの最後を 2 でなく 1 にすると期待値の列で、照らしの境目を 0.9 にすると照らしで、
//   観察へ進む条件を1つ引いただけにすると、2つ目を引いた時点の「まだ進めない」で落ちることを見た（引く前だけを見ると見つからなかった）。
//   種を分けないと、20 回と 40 回の引いた平均が同じ数になって落ちることを見た（スクリーンショットで気づいた）
test("B-01：倍々のくじ。予測（下・上・同じ）→ 3つの打ち切りを引く → 期待値と平均 → 項と裾 → 応用", async ({ page }) => {
  const errs: string[] = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(`./?${SRC}&x=${X}&q=${Q}`);
  const x = page.getByTestId("experiment");
  await expect(x.getByTestId("exp-base-mean")).toContainText("打ち切り 20 回の期待値は 21円");
  const pred = x.getByTestId("exp-pred-lln");
  await expect(pred.getByRole("radio")).toHaveText([
    "21円 より下に出ることが多い",
    "21円 より上に出ることが多い",
    "上と下が同じくらい",
  ]);
  await pred.getByRole("radio", { name: "上と下が同じくらい" }).click();
  await x.getByRole("button", { name: "この予測で引いてみる" }).click();
  await expect(x.getByTestId("exp-to-observe")).toBeDisabled();
  for (const K of [10, 20, 40]) {
    await x.getByRole("radio", { name: `打ち切り ${K} 回` }).click();
    await x.getByTestId("exp-run-1000").click();
    await expect(x.getByTestId("exp-run-1000")).toContainText("引いた");
    // 3つとも引くまでは観察へ進めない（1つ・2つ引いた時点でも）
    if (K !== 40) await expect(x.getByTestId("exp-to-observe")).toBeDisabled();
  }
  await x.getByTestId("exp-to-observe").click();
  const v = x.getByTestId("exp-verdict");
  await expect(v).toContainText("✗ 予測と違った");
  const pct = Number((await v.innerText()).match(/おおよそ (\d+)%/)![1]);
  expect(Math.abs(pct - 84)).toBeLessThanOrEqual(3);
  await expect(v).toContainText("（21円 より下に出ることが多い）");
  const theory = await Promise.all(
    [0, 1, 2].map(async (i) => x.getByTestId(`exp-row-${i}`).locator("td").nth(1).innerText()),
  );
  expect(theory).toEqual(["11円", "21円", "41円"]);
  // 3つの打ち切りは別々の種で引く（同じ種だと 20 回と 40 回の平均がほぼいつも同じ数になる）
  const drawn = await Promise.all(
    [0, 1, 2].map(async (i) => x.getByTestId(`exp-row-${i}`).locator("td").nth(2).innerText()),
  );
  expect(drawn[1]).not.toBe(drawn[2]);
  await expect(x.getByTestId("exp-mean-margin")).toContainText(
    "打ち切り 10 回 ±3.4円・打ち切り 20 回 ±110円・打ち切り 40 回 ±11万円",
  );
  await expect(x.getByTestId("exp-below-freq")).toContainText("1,000 回の実験を 2000 組");
  await x.getByRole("button", { name: /理由を考える/ }).click();
  await expect(x.getByTestId("exp-lln-terms")).toContainText("11円・打ち切り 20 回 21円・打ち切り 40 回 41");
  await expect(x.getByTestId("exp-lln-tail")).toContainText("31 円分");
  await expect(x.getByTestId("exp-lln-tail")).toContainText("約 62%");
  await expect(x.getByTestId("exp-lln-tail")).toContainText("約 5.9%");
  await expect(x.getByTestId("exp-lln-cond")).toContainText("約 7,800億 回");
  await x.getByRole("button", { name: "応用の課題へ" }).click();
  const a = x.getByTestId("exp-apply");
  await expect(a).toHaveAttribute("data-kind", "反証");
  await a.getByRole("radio", { name: "打ち切り 20 回の表" }).click(); // 15 は 21 より 11 に近い（見当で選びやすい側の逆）
  await a.getByTestId("exp-apply-check").click();
  await expect(a.getByTestId("exp-apply-verdict")).toHaveAttribute("data-ok", "false");
  await expect(a.getByTestId("exp-apply-answer")).toHaveText("打ち切り 10 回の表");
  expect(errs).toEqual([]);
});
