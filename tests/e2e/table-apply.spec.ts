// 値の表の実験室（期待値）の応用の段（stats2-course #364）。見本にはまだ応用がないので、読み込みを書き換えて足す（CLAUDE.md「テストの見本」）。
//
// 確かめる対象：A-01（逆算）・A-02（反証）・D-01（モデル選択）で、考察のあとに応用の段へ進み、課題に答えると engine が求めた答えで照らし、
//   解き方の段が出ること。つまみ合わせ（グラフを問いに合わせる）は値の表にはまだないので出さない。
// 想定する故障：値の表の問いに apply を渡し忘れる（応用の段が出ない・考察から先へ進めない）、A-02・D-01 の段の数を変え忘れる
//   （応用の段の名前が出ない）、つまみのない実験室に「下のつまみを合わせる」と書く、答えの番号と選び肢がずれる。
// 見つけ方：3問を予測から応用まで通し、正しい答え（手で求めた値：A-01 は (15＋6w)÷(5＋w)＝4 から w＝2.5、A-02 は 0・2・8（重み 3・1・1）の
//   期待値 2 は表の値でも P(2)＝20% で、いちばん出るのは 0（60%）なので「言えない」、D-01 は 1000 円の当たりがない C（0・500 円）の分散が 17556 で、B の 11356 がいちばん小さい）で「合っている」、
//   A-02 は違う答えで「ちがう」になり、自分の答えと正しい答えを分けて出す。
// 既存との違い：engine のテスト（applyTable.test.ts）は答えの数。これは画面の流れと照らし。二項分布の応用のテストは別の部品（つまみ合わせつき）。
// 検出の確かめ（2026-11-14）：Experiment.tsx で TableSupportQ に apply を渡さないと A-02 が落ちることを見た
import { test, expect, type Page } from "@playwright/test";

const SRC = "src=sample/stats2.json";
const X = encodeURIComponent("stats2:EXP-expect-table");
const APPLY: Record<string, object> = {
  "stats2:expect-A-01": {
    kind: "逆算",
    task: "さいころの 6 の目だけ重みを変える（ほかの目の重みは 1）。6 の目の重みをいくつにすると、期待値がちょうど 4 になる？",
    solve: {
      method: "table-weight-for-mean",
      values: [1, 2, 3, 4, 5, 6],
      weights: [1, 1, 1, 1, 1, 1],
      index: 5,
      mean: 4,
    },
    answer: { type: "number", tol: { abs: 0.05 } },
    why: "動かしたい先から逆に、重みを1つ決められる。",
  },
  "stats2:expect-A-02": {
    kind: "反証",
    task: "値 0・2・8（重み 3・1・1）の表は、期待値がちょうど表の値の1つになる。では「1回引くと、期待値の値がいちばん出やすい」と言える？",
    solve: { method: "table-mean-mode", values: [0, 2, 8], weights: [3, 1, 1] },
    answer: { type: "choice", options: ["言える", "言えない"] },
    why: "期待値は値×確率の和（重心）で、いちばん出やすい値とは別のもの。",
  },
  "stats2:expect-D-01": {
    kind: "モデル選択",
    task: "A・B に、期待値が同じ 38 円のくじ C（0 円 924・500 円 76）を足す。毎回の結果をなるべくそろえたい人に向くのはどれ？",
    solve: {
      method: "table-min-var",
      tables: [
        { values: [0, 100, 1000], weights: [80, 18, 2], name: "A" },
        { values: [0, 100, 1000], weights: [71, 28, 1], name: "B" },
        { values: [0, 500], weights: [924, 76], name: "C" },
      ],
      unit: "円",
    },
    answer: { type: "choice", options: ["A", "B", "C"] },
    why: "期待値が同じなら、散らばり（分散）で選ぶ。",
  },
};
async function withApply(page: Page) {
  await page.route("**/sample/stats2.json", async (r) => {
    const d = await (await r.fetch()).json();
    const x = d.experiments.find((e: { id: string }) => e.id === "stats2:EXP-expect-table");
    for (const g of x.catalog) for (const it of g.items) if (APPLY[it.id]) it.apply = APPLY[it.id];
    await r.fulfill({ json: d });
  });
}
async function reasonToApply(page: Page) {
  const x = page.getByTestId("experiment");
  // 考察の式を1段ずつ開く部品は問いで1つ（A-01）か2つ（D-01 の表 A・B）。押せるものがなくなるまで送る
  const next = x.getByRole("button", { name: "次の段" });
  for (;;) {
    const i = await next.evaluateAll((bs) => bs.findIndex((b) => !(b as HTMLButtonElement).disabled));
    if (i < 0) break;
    await next.nth(i).click();
  }
  await x.getByRole("button", { name: "応用の課題へ" }).click();
  const a = x.getByTestId("exp-apply");
  await expect(a).toBeVisible();
  await expect(a).toContainText("課題の数から計算して答える"); // つまみのない実験室に「つまみを合わせる」と書かない
  await expect(x.getByTestId("exp-apply-fit")).toHaveCount(0);
  return a;
}

test.beforeEach(async ({ page }) => {
  await withApply(page);
  await page.setViewportSize({ width: 390, height: 844 });
});

test("A-01：考察のあとの応用（逆算）で、重み 2.5 を照らす", async ({ page }) => {
  await page.goto(`./?${SRC}&x=${X}&q=${encodeURIComponent("stats2:expect-A-01")}`);
  const x = page.getByTestId("experiment");
  await x.getByRole("slider", { name: "予測する平均" }).fill("4.5");
  await x.getByRole("button", { name: "この予測で引いてみる" }).click();
  await x.getByTestId("exp-run-100").click();
  await x.getByRole("button", { name: "観察する →" }).click();
  await x.getByRole("button", { name: /理由を考える/ }).click();
  const a = await reasonToApply(page);
  await expect(a).toHaveAttribute("data-kind", "逆算");
  await a.getByTestId("exp-apply-input").fill("2.5");
  await a.getByTestId("exp-apply-check").click();
  await expect(a.getByTestId("exp-apply-verdict")).toHaveAttribute("data-ok", "true");
  await expect(a.getByTestId("exp-apply-answer")).toHaveText("2.5");
  await expect(a.getByTestId("exp-apply-steps").getByRole("listitem")).toHaveCount(5);
});

test("A-02：考察のあとに5段目（応用）が出て、反証の答えを照らす", async ({ page }) => {
  await page.goto(`./?${SRC}&x=${X}&q=${encodeURIComponent("stats2:expect-A-02")}`);
  const x = page.getByTestId("experiment");
  await expect(x.getByRole("list", { name: "段" }).getByRole("button")).toHaveCount(5);
  await x.getByRole("slider", { name: "予測する平均" }).fill("3.5");
  await x.getByRole("radiogroup", { name: "1回で出るかの予測" }).getByRole("radio", { name: "1回では出ない" }).click();
  await x.getByRole("button", { name: "この予測で引いてみる" }).click();
  await x.getByTestId("exp-run-100").click();
  await x.getByTestId("exp-to-observe").click();
  await x.getByRole("button", { name: /理由を考える/ }).click();
  const a = await reasonToApply(page);
  await expect(a).toHaveAttribute("data-kind", "反証");
  await a.getByRole("radio", { name: "言える", exact: true }).click();
  await a.getByTestId("exp-apply-check").click();
  await expect(a.getByTestId("exp-apply-verdict")).toHaveAttribute("data-ok", "false");
  await expect(a.getByTestId("exp-apply-answer")).toHaveText("言えない");
  await expect(a.getByTestId("exp-apply-yours")).toContainText("あなたの答え：言える");
  // 解き方の段で、期待値の値の確率（20%）といちばん出る値（0 の 60%）を比べる
  await expect(a.getByTestId("exp-apply-steps")).toContainText("60%");
  await a.getByTestId("exp-apply-retry").click();
  await a.getByRole("radio", { name: "言えない" }).click();
  await a.getByTestId("exp-apply-check").click();
  await expect(a.getByTestId("exp-apply-verdict")).toHaveAttribute("data-ok", "true");
});

test("D-01：散らばりを数にしたあとの応用（モデル選択）で B を照らす", async ({ page }) => {
  await page.goto(`./?${SRC}&x=${X}&q=${encodeURIComponent("stats2:expect-D-01")}`);
  const x = page.getByTestId("experiment");
  await x.getByRole("radio", { name: /くじ/ }).click();
  await x.getByTestId("exp-pred-mean").getByRole("radio", { name: "A が大きい" }).click();
  await x.getByRole("button", { name: /この予測で引いてみる/ }).click();
  await x.getByTestId("exp-run-100").click();
  await x.getByTestId("exp-to-observe").click();
  await x.getByRole("button", { name: "見つけた違いを数にする" }).click();
  const a = await reasonToApply(page);
  await expect(a).toHaveAttribute("data-kind", "モデル選択");
  await a.getByRole("radio", { name: "B" }).click();
  await a.getByTestId("exp-apply-check").click();
  await expect(a.getByTestId("exp-apply-verdict")).toHaveAttribute("data-ok", "true");
  await expect(a.getByTestId("exp-apply-steps")).toContainText("17556");
  await expect(a.getByTestId("exp-apply-steps")).toContainText("期待値 38円"); // 期待値に単位（課題は円）
});
