// 期待値の実験室 A-02「期待値は、実際に出る値？」（表を変えない問い。stats2-course #119）。見本の A-02 はまだ作成中なので、読み込みを書き換えて開く。
import { test, expect, type Page } from "@playwright/test";

const SRC = "src=sample/stats2.json";
const noErrors = (page: Page) => {
  const errs: string[] = [];
  page.on("pageerror", (e) => errs.push(e.message));
  return errs;
};

async function withA02(page: Page) {
  await page.route("**/sample/stats2.json", async (r) => {
    const d = await (await r.fetch()).json();
    const x = d.experiments.find((e: { id: string }) => e.id === "stats2:EXP-expect-table");
    const it = x.catalog
      .flatMap((g: { items: { id: string }[] }) => g.items)
      .find((i: { id: string }) => i.id === "stats2:expect-A-02");
    Object.assign(it, {
      open: "support",
      predict: "平均の行き先と、その値が1回で出るか",
      operate: "引く回数",
      judge: "説明できる",
    });
    await r.fulfill({ json: d });
  });
}

// 確かめる対象：表を変えない問いの流れ（予測 → 実験 → 観察 → 考察）。予測の前に▲（期待値の値）を見せないこと、
//   観察の照らし（さいころの期待値 3.5 は表の値にないので「1回では出ない」が正しい）、考察で値×確率を項に開き、最後に主概念（期待値）の札。
// 想定する故障：予測の前に期待値の値を出す（予測する量の答えを先に見せる）・照らしの向きを逆にする（3.5 を「出る」とする）・
//   入口の一覧で A-02 が開けない・考察に式が出ない。
// 見つけ方：書き換えた教材で A-02 を入口から開き、予測の段に「3.5」が出ていないこと、「1回では出ない」で ✓、「1回で出る」で ✗、
//   考察の項の展開と概念の札を見る。手で求めた値：(1＋2＋3＋4＋5＋6)÷6＝3.5。
// 既存との違い：table-catalog.spec.ts は入口と開き方、viewer.spec.ts は表を変える問い（A-01）。ここは表を変えない問いの中身。
// 検出の確かめ（2026-11-12）：照らしの actual を逆にすると ✓ の確かめで、予測の段の Bars に marker を渡すと「3.5 が出ない」で落ちることを見た。つまみの始まりを表の真ん中にしたときも同じ確かめで落ちた（書いた時点の誤り）
test("A-02：予測の前に期待値を見せず、さいころの 3.5 は1回では出ないと照らし、考察で項に開く", async ({ page }) => {
  const errs = noErrors(page);
  await withA02(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`./?${SRC}&x=${encodeURIComponent("stats2:EXP-expect-table")}`);
  const x = page.getByTestId("experiment");
  await x.getByTestId("exp-q-A-02").click();
  await expect(x.getByTestId("exp-question")).toContainText("1回引いて出る値");
  await expect(x.getByRole("radiogroup", { name: "テーマ" }).getByRole("radio", { name: /さいころ/ })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(x).not.toContainText("3.5"); // 予測する量（期待値）を先に出さない（つまみの始まりが答えと重なる故障もここで見つかった）
  await expect(x.getByTestId("exp-marker")).toHaveCount(0); // ▲（期待値の位置）も予測の前には出さない
  await x.getByRole("slider", { name: "予測する平均" }).fill("3.5");
  await x.getByRole("radiogroup", { name: "1回で出るかの予測" }).getByRole("radio", { name: "1回では出ない" }).click();
  await x.getByRole("button", { name: "この予測で引いてみる" }).click();
  await x.getByTestId("exp-run-100").click();
  await expect(x.getByTestId("exp-sets")).toHaveText("100 回");
  await x.getByTestId("exp-to-observe").click();
  const v = x.getByTestId("exp-verdict");
  await expect(v).toContainText("✓ 予測どおり");
  await expect(v).toContainText("期待値は 3.5");
  await expect(v).toContainText("1回では一度も出ない");
  await x.getByRole("button", { name: /理由を考える/ }).click();
  await expect(x.getByTestId("exp-expand")).toBeVisible();
  await expect(x.getByTestId("exp-found").getByRole("button")).toHaveText(["期待値"]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  // 逆の予測は ✗
  await x.getByRole("list", { name: "段" }).getByRole("button", { name: /予測/ }).click();
  await x.getByRole("radiogroup", { name: "1回で出るかの予測" }).getByRole("radio", { name: "1回で出る" }).click();
  await x.getByRole("list", { name: "段" }).getByRole("button", { name: /観察/ }).click();
  await expect(x.getByTestId("exp-verdict")).toContainText("✗ 予測と違った");
  expect(errs).toEqual([]);
});
