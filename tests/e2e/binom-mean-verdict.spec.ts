// 二項分布 D-01「成功回数の期待値はどこにある？」（n＝10・p＝0.35、np＝3.5）の予測と照らし（stats2-course #372）。
import { test, expect, type Page } from "@playwright/test";

const SRC = "src=sample/stats2.json";

// 確かめる対象：照らしが予測と同じ粒度（0.5 刻みのいちばん近い目）で、山の頂点（最頻値 3）を選んでも○にならないこと。予測の注記に答え（3.5）を書かないこと。
// 想定する故障：照らしの幅を ±0.5 にして 3・4 も○にする（平均と最頻値の取り違えを照らせない）・注記の例が答えそのものになる（⑦ の 2：その問いで見つけることを先に言わない）。
// 見つけ方：3 を選ぶと ✗、3.5 を選ぶと ✓。予測の段に「3.5」が出ないこと。
// 既存との違い：viewer.spec.ts の応用の全問テストは応用の段だけで、予測の照らしは見ていない。
// 検出の確かめ（2026-11-12）：照らしの幅を 0.5 に戻すと 3 の ✗ で、注記に「3.5 など」を戻すと「3.5」が出ないことで落ちることを見た
async function predictAndObserve(page: Page, presses: number) {
  await page.goto(`./?${SRC}&x=stats2:EXP-binom-p&q=stats2:binom-D-01`);
  const x = page.getByTestId("experiment");
  await expect(x.getByTestId("exp-question")).toBeVisible();
  await expect(x).not.toContainText("3.5");
  for (let i = 0; i < presses; i++) await x.getByRole("button", { name: "減らす" }).click();
  await x.getByRole("button", { name: /この予測で/ }).click();
  await x.getByTestId("exp-run-100").click();
  await x.getByTestId("exp-to-observe").click();
  return x.getByTestId("exp-verdict");
}

test("二項分布 D-01：頂点の 3 は ✗、平均の 3.5 は ✓（照らしは予測と同じ粒度）", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  // 何も選んでいない所から「減らす」で 5 → 4.5 → 4 → 3.5 → 3
  await expect(await predictAndObserve(page, 4)).toContainText("予測と違った");
  await expect(await predictAndObserve(page, 3)).toContainText("予測どおり");
});

// 確かめる対象：二項分布 A-01（p を 50%→80%、n＝10）で、予測した頂点の回数で照らすこと（予測1つに照らし1つ。⑦ の 2。stats2-course #372）。
// 想定する故障：頂点の回数を選ばせて向きだけで照らす（7 回と予測しても「右へ動く」が合えば ✓ になる）。
// 見つけ方：7 回と予測すると ✗ で「向きは予測どおり」が添えられる（8 回と予測して ✓ になるのは viewer.spec.ts の流れのテスト）。
// 既存との違い：viewer.spec.ts の A-01 は正しい予測（8 回）だけ。
// 検出の確かめ（2026-11-13）：照らしを dir(guess) === dir(k1) に戻すと「予測と違った」で落ちることを見た
test("二項分布 A-01：頂点を 7 回と予測すると ✗（向きは合っても回数で照らす）", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`./?${SRC}&x=stats2:EXP-binom-p&q=stats2:binom-A-01`);
  const x = page.getByTestId("experiment");
  await x
    .getByRole("radiogroup", { name: /いちばん高い所/ })
    .getByRole("radio", { name: "7 回" })
    .click();
  await x.getByRole("button", { name: "この予測で実験する" }).click();
  await x.getByTestId("exp-run-big").click();
  await x.getByTestId("exp-to-observe").click();
  await expect(x.getByTestId("exp-verdict")).toContainText("予測と違った");
  await expect(x.getByTestId("exp-verdict")).toContainText("向きは予測どおり");
  // 観察は頂点だけ。平均（D-01 で見つける）を出さず、頂点が乱数で隣にずれうる頻度を書く（⑦ の 2。stats2-course #379）
  await expect(x.getByTestId("exp-peak-note")).toContainText("隣にずれやすい");
  await expect(x).not.toContainText("平均（後）");
});

// 確かめる対象：前提崩し（E-01〜04）の予測の段に、1回ごとの確率をならすと p のままであることが出ること（stats2-course #379）。
// 想定する故障：書かないと「確率が下がる→成功が減る→山が狭い」と誤った理由でも E-01 で ✓ になる（2級の学習者の役のレビューで見つけた）。
// 見つけ方：E-01 を開いた予測の段に、二項分布の p（50%）と「のまま」が出る。
// 既存との違い：viewer.spec.ts の前提崩しのテストは照らしと観察の数を見て、予測の段の文は見ていない。
// 検出の確かめ（2026-11-13）：BreakQ の exp-break-mean の段落を見つからなくする（testid を変える）と落ちることを見た
test("前提崩し E-01：予測の段に「確率をならすと p のまま」", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`./?${SRC}&x=stats2:EXP-binom-p&q=stats2:binom-E-01`);
  await expect(page.getByTestId("experiment").getByTestId("exp-break-mean")).toContainText("50% のまま");
});
